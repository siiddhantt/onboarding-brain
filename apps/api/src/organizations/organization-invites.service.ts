import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from './organizations.service';
import { AuthService } from '../auth/auth.service';
// EmailService removed
import { NotificationsService } from '../notifications/services/notifications.service';
import { OrgRole } from '@app-starter/shared';
import { InviteStatus, OrgRole as PrismaOrganizationRole, Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import {
  InviteValidationException,
  InvitePermissionException,
  InviteNotFoundException,
  InviteTokenNotFoundException,
  InviteCancelledException,
  InviteExpiredException,
  InviteAlreadyAcceptedException,
  EmailVerificationNotFoundException,
  EmailVerificationExpiredException,
  EmailVerificationAlreadyUsedException,
  InviteAccessDeniedException,
} from './exceptions/invites.exceptions';

@Injectable()
export class OrganizationInvitesService {
  private readonly logger = new Logger(OrganizationInvitesService.name);
  private readonly INVITATION_EXPIRATION_MONTHS = 6;
  private readonly VERIFICATION_EXPIRATION_HOURS = 24;

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private organizationsService: OrganizationsService,
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

  /**
   * Generate secure invitation token
   */
  private generateInviteToken(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  /**
   * Generate secure verification token
   */
  private generateVerificationToken(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  /**
   * Calculate expiration date for invitation (6 months from now)
   */
  private getInvitationExpirationDate(): Date {
    const date = new Date();
    date.setMonth(date.getMonth() + this.INVITATION_EXPIRATION_MONTHS);
    return date;
  }

  /**
   * Calculate expiration date for verification (24 hours from now)
   */
  private getVerificationExpirationDate(): Date {
    const date = new Date();
    date.setHours(date.getHours() + this.VERIFICATION_EXPIRATION_HOURS);
    return date;
  }

  /**
   * Check if invitation is expired
   */
  private isInvitationExpired(expiresAt: Date): boolean {
    return new Date() > expiresAt;
  }

  /**
   * Check if verification is expired
   */
  private isVerificationExpired(expiresAt: Date): boolean {
    return new Date() > expiresAt;
  }

  /**
   * Get frontend URL for invitation links
   */
  private getFrontendUrl(): string {
    return this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
  }

  /**
   * Invitation management matches the organization settings permissions.
   */
  private async canManageInvites(organizationId: string, userId: string): Promise<boolean> {
    const role = await this.organizationsService.getUserRoleInOrganization(userId, organizationId);
    return role === OrgRole.OWNER || role === OrgRole.ADMIN;
  }

  private assertInviteEmail(invitedEmail: string | null, recipientEmail: string): void {
    if (invitedEmail && invitedEmail.trim().toLowerCase() !== recipientEmail.trim().toLowerCase()) {
      throw new InviteAccessDeniedException('This invitation is addressed to a different email');
    }
  }

  private async claimInvite(
    tx: Prisma.TransactionClient,
    inviteId: string,
    organizationId: string,
  ): Promise<void> {
    // Claim and membership creation share a transaction, so a single-use link cannot admit twice.
    const claimed = await tx.organizationInvite.updateMany({
      where: {
        id: inviteId,
        organizationId,
        status: InviteStatus.PENDING,
        expiresAt: { gt: new Date() },
      },
      data: { status: InviteStatus.ACCEPTED },
    });
    if (claimed.count !== 1) {
      throw new InviteValidationException('This invitation is no longer available');
    }
  }

  /**
   * Validate invitation token and status
   */
  private async validateInvite(token: string): Promise<{
    id: string;
    organizationId: string;
    token: string;
    email: string | null;
    invitedRole: PrismaOrganizationRole;
    expiresAt: Date;
    status: InviteStatus;
    createdAt: Date;
    updatedAt: Date;
    createdBy: string;
  }> {
    const invite = await this.prisma.organizationInvite.findUnique({
      where: { token },
    });

    if (!invite) {
      throw new InviteTokenNotFoundException();
    }

    // Check if expired
    if (this.isInvitationExpired(invite.expiresAt)) {
      throw new InviteExpiredException();
    }

    // Check if cancelled
    if (invite.status === InviteStatus.CANCELLED) {
      throw new InviteCancelledException();
    }

    // Check if already accepted (single-use only)
    if (invite.status === InviteStatus.ACCEPTED) {
      throw new InviteAlreadyAcceptedException();
    }

    return invite;
  }

  /**
   * Check if invitation can be accepted
   */
  private async canAcceptInvite(invite: {
    status: InviteStatus;
    expiresAt: Date;
  }): Promise<boolean> {
    // Check expiration
    if (this.isInvitationExpired(invite.expiresAt)) {
      return false;
    }

    // Check if cancelled
    if (invite.status === InviteStatus.CANCELLED) {
      return false;
    }

    // Can only be accepted if still PENDING
    return invite.status === InviteStatus.PENDING;
  }

  /**
   * Get invite details by token (public, no auth required)
   */
  async getInviteByToken(token: string) {
    const invite = await this.prisma.organizationInvite.findUnique({
      where: { token },
      select: {
        id: true,
        email: true,
        expiresAt: true,
        status: true,
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    if (!invite) {
      throw new InviteTokenNotFoundException();
    }

    // Check if expired
    if (this.isInvitationExpired(invite.expiresAt)) {
      throw new InviteExpiredException();
    }

    // Check if cancelled
    if (invite.status === InviteStatus.CANCELLED) {
      throw new InviteCancelledException();
    }

    return {
      email: invite.email,
      organization: invite.organization,
      expiresAt: invite.expiresAt.toISOString(),
    };
  }

  /**
   * Create invitation (with or without email)
   */
  async createInvite(
    organizationId: string,
    userId: string,
    email: string | undefined,
    role: OrgRole,
  ) {
    // Check permissions
    const canManage = await this.canManageInvites(organizationId, userId);
    if (!canManage) {
      throw new InvitePermissionException();
    }

    if (role === OrgRole.OWNER) {
      throw new InviteValidationException('Cannot assign owner role via invitation');
    }

    // Verify organization exists
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new InviteValidationException('Organization not found');
    }

    const trimmedEmail = email?.trim().toLowerCase();
    if (trimmedEmail) {
      const dup = await this.prisma.organizationInvite.findFirst({
        where: {
          organizationId,
          status: InviteStatus.PENDING,
          email: { equals: trimmedEmail, mode: 'insensitive' },
        },
      });
      if (dup) {
        throw new BadRequestException('An active invitation already exists for this email.');
      }
    }

    // Generate token and ensure uniqueness
    let token = this.generateInviteToken();
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      const existing = await this.prisma.organizationInvite.findUnique({
        where: { token },
      });

      if (!existing) {
        break;
      }

      token = this.generateInviteToken();
      attempts++;
    }

    if (attempts >= maxAttempts) {
      throw new InviteValidationException('Failed to generate unique invitation token');
    }

    // Create invitation
    const expiresAt = this.getInvitationExpirationDate();
    const frontendUrl = this.getFrontendUrl();
    const inviteUrl = `${frontendUrl}/invites/accept?token=${token}`;

    const invite = await this.prisma.organizationInvite.create({
      data: {
        organizationId,
        token,
        email: trimmedEmail || null,
        invitedRole: role as unknown as PrismaOrganizationRole,
        expiresAt,
        isReusable: false,
        status: InviteStatus.PENDING,
        createdBy: userId,
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    // Get creator info
    const creator = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    // Send email if provided
    if (trimmedEmail) {
      try {
        // Create email verification record for email-based invites
        let verifyToken = this.generateVerificationToken();
        let attempts = 0;
        const maxAttempts = 5;

        while (attempts < maxAttempts) {
          const existing = await this.prisma.inviteEmailVerification.findUnique({
            where: { token: verifyToken },
          });

          if (!existing) {
            break;
          }

          verifyToken = this.generateVerificationToken();
          attempts++;
        }

        if (attempts >= maxAttempts) {
          throw new InviteValidationException('Failed to generate unique verification token');
        }

        // Create email verification record
        const verificationExpiresAt = this.getVerificationExpirationDate();
        await this.prisma.inviteEmailVerification.create({
          data: {
            inviteId: invite.id,
            token: verifyToken,
            email: trimmedEmail,
            name: null, // Name will be provided when they verify
            expiresAt: verificationExpiresAt,
          },
        });

        // Include verification token in email URL
        const inviteUrl = `${frontendUrl}/invites/verify?token=${token}&verify=${verifyToken}`;
        // Send invitation email using notifications service
        await this.notificationsService.sendNotification(
          'user-invitation',
          { type: 'email', email: trimmedEmail },
          {
            organizationName: organization.name,
            inviterName: creator?.name || 'Admin',
            invitationUrl: inviteUrl,
            roleName: role === OrgRole.ADMIN ? 'Admin' : 'Member',
          },
          organization.id,
        );
      } catch (error) {
        this.logger.error(`Failed to send invitation email to ${trimmedEmail}`, error);
      }
    }

    return {
      id: invite.id,
      organizationId: invite.organizationId,
      token: invite.token,
      inviteUrl,
      email: invite.email,
      role: invite.invitedRole as OrgRole,
      expiresAt: invite.expiresAt.toISOString(),
      createdAt: invite.createdAt.toISOString(),
      createdBy: {
        id: creator?.id || userId,
        name: creator?.name || null,
        email: creator?.email || '',
      },
      status: invite.status,
    };
  }

  /**
   * Get all invitations for a organization
   */
  async getOrganizationInvites(
    organizationId: string,
    userId: string,
    statusFilter?: 'pending' | 'all',
  ) {
    // Check permissions
    const canManage = await this.canManageInvites(organizationId, userId);
    if (!canManage) {
      throw new InvitePermissionException();
    }

    // Verify organization exists
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new InviteValidationException('Organization not found');
    }

    const invites = await this.prisma.organizationInvite.findMany({
      where: {
        organizationId,
        ...(statusFilter === 'pending' ? { status: InviteStatus.PENDING } : {}),
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const frontendUrl = this.getFrontendUrl();

    return {
      invites: invites.map((invite) => {
        // Calculate status (mark as EXPIRED if past expiration)
        let status = invite.status;
        if (status === InviteStatus.PENDING && this.isInvitationExpired(invite.expiresAt)) {
          status = InviteStatus.EXPIRED;
        }

        return {
          id: invite.id,
          token: invite.token,
          inviteUrl: `${frontendUrl}/invites/accept?token=${invite.token}`,
          email: invite.email,
          role: invite.invitedRole as OrgRole,
          expiresAt: invite.expiresAt.toISOString(),
          createdAt: invite.createdAt.toISOString(),
          createdBy: {
            id: invite.createdBy,
            name: null, // Will be populated if needed
            email: '',
          },
          status,
        };
      }),
    };
  }

  /**
   * Resend invitation email (pending, email-based invites only)
   */
  async resendInvite(organizationId: string, inviteId: string, userId: string) {
    const canManage = await this.canManageInvites(organizationId, userId);
    if (!canManage) {
      throw new InvitePermissionException();
    }

    const invite = await this.prisma.organizationInvite.findUnique({
      where: { id: inviteId, organizationId },
      include: {
        organization: { select: { id: true, name: true } },
      },
    });

    if (!invite || invite.organizationId !== organizationId) {
      throw new InviteNotFoundException(inviteId);
    }

    if (invite.status !== InviteStatus.PENDING) {
      throw new InviteValidationException('Only pending invitations can be resent');
    }

    const email = invite.email?.trim();
    if (!email) {
      throw new InviteValidationException(
        'This invitation has no email; copy the invite link instead.',
      );
    }

    const creator = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });

    const frontendUrl = this.getFrontendUrl();
    let verifyToken = this.generateVerificationToken();
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      const existing = await this.prisma.inviteEmailVerification.findUnique({
        where: { token: verifyToken },
      });
      if (!existing) break;
      verifyToken = this.generateVerificationToken();
      attempts++;
    }

    if (attempts >= maxAttempts) {
      throw new InviteValidationException('Failed to generate unique verification token');
    }

    const verificationExpiresAt = this.getVerificationExpirationDate();
    await this.prisma.inviteEmailVerification.create({
      data: {
        inviteId: invite.id,
        token: verifyToken,
        email,
        name: null,
        expiresAt: verificationExpiresAt,
      },
    });

    const inviteUrl = `${frontendUrl}/invites/verify?token=${invite.token}&verify=${verifyToken}`;

    await this.notificationsService.sendNotification(
      'user-invitation',
      { type: 'email', email },
      {
        organizationName: invite.organization.name,
        inviterName: creator?.name || 'Admin',
        invitationUrl: inviteUrl,
        roleName: invite.invitedRole === PrismaOrganizationRole.ADMIN ? 'Admin' : 'Member',
      },
      invite.organization.id,
    );

    return { message: 'Invitation email resent' };
  }

  /**
   * Cancel an invitation
   */
  async cancelInvite(organizationId: string, inviteId: string, userId: string) {
    // Check permissions
    const canManage = await this.canManageInvites(organizationId, userId);
    if (!canManage) {
      throw new InvitePermissionException();
    }

    // Verify invitation exists and belongs to organization
    const invite = await this.prisma.organizationInvite.findUnique({
      where: { id: inviteId, organizationId },
    });

    if (!invite || invite.organizationId !== organizationId) {
      throw new InviteNotFoundException(inviteId);
    }

    // Check if already cancelled or accepted (for single-use)
    if (invite.status === InviteStatus.CANCELLED) {
      throw new InviteValidationException('Invitation is already cancelled');
    }

    // Update status to CANCELLED
    const updated = await this.prisma.organizationInvite.update({
      where: { id: inviteId },
      data: {
        status: InviteStatus.CANCELLED,
      },
    });

    return {
      id: updated.id,
      status: InviteStatus.CANCELLED,
      cancelledAt: updated.updatedAt.toISOString(),
    };
  }

  /**
   * Accept invitation (authenticated user)
   */
  async acceptInvite(token: string, userId: string) {
    // Validate invitation
    const invite = await this.validateInvite(token);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, emailVerifiedAt: true },
    });
    if (!user?.emailVerifiedAt) {
      throw new InviteAccessDeniedException('Verify your email before accepting an invitation');
    }
    this.assertInviteEmail(invite.email, user.email);

    // Check if can be accepted
    const canAccept = await this.canAcceptInvite(invite);
    if (!canAccept) {
      throw new InviteExpiredException();
    }

    // Enforce maximum of 10 organizations per user (create or belong to)
    const userOrganizationsCount = await this.prisma.organizationMember.count({
      where: { userId },
    });

    if (userOrganizationsCount >= 10) {
      // Check if user is already a member of *this* organization, if so, allow (message will handle it)
      const isMember = await this.prisma.organizationMember.findUnique({
        where: { userId_organizationId: { userId, organizationId: invite.organizationId } },
      });
      if (!isMember) {
        throw new InviteValidationException(
          'You have reached the maximum limit of 10 organizations.',
        );
      }
    }

    // Get organization info
    const organization = await this.prisma.organization.findUnique({
      where: { id: invite.organizationId },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
      },
    });

    if (!organization) {
      throw new InviteValidationException('Organization not found');
    }

    // Check if user is already a member
    const existingMembership = await this.prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId: invite.organizationId,
        },
      },
    });

    const membership = await this.prisma.$transaction(async (tx) => {
      await this.claimInvite(tx, invite.id, invite.organizationId);
      return tx.organizationMember.upsert({
        where: { userId_organizationId: { userId, organizationId: invite.organizationId } },
        create: {
          userId,
          organizationId: invite.organizationId,
          role: invite.invitedRole,
        },
        update: {},
      });
    });

    return {
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        description: organization.description,
      },
      role: membership.role as OrgRole,
      message: existingMembership
        ? 'You are already a member of this organization'
        : 'You have been added to the organization',
    };
  }

  /**
   * Submit email for invitation (unauthenticated)
   */
  async submitEmailForInvite(
    token: string,
    data: { name: string; email: string; confirmEmail: string },
  ) {
    // Validate email match
    const email = data.email.trim().toLowerCase();
    if (email !== data.confirmEmail.trim().toLowerCase()) {
      throw new InviteValidationException('Email addresses do not match');
    }

    // Validate invitation
    const invite = await this.validateInvite(token);
    this.assertInviteEmail(invite.email, email);

    // Check if can be accepted
    const canAccept = await this.canAcceptInvite(invite);
    if (!canAccept) {
      throw new InviteExpiredException();
    }

    // Get organization info
    const organization = await this.prisma.organization.findUnique({
      where: { id: invite.organizationId },
      select: {
        name: true,
      },
    });

    if (!organization) {
      throw new InviteValidationException('Organization not found');
    }

    // Generate verification token
    let verifyToken = this.generateVerificationToken();
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      const existing = await this.prisma.inviteEmailVerification.findUnique({
        where: { token: verifyToken },
      });

      if (!existing) {
        break;
      }

      verifyToken = this.generateVerificationToken();
      attempts++;
    }

    if (attempts >= maxAttempts) {
      throw new InviteValidationException('Failed to generate unique verification token');
    }

    // Create email verification record
    const expiresAt = this.getVerificationExpirationDate();
    await this.prisma.inviteEmailVerification.create({
      data: {
        inviteId: invite.id,
        token: verifyToken,
        email,
        name: data.name,
        expiresAt,
      },
    });

    // Send verification email
    const frontendUrl = this.getFrontendUrl();
    const verificationUrl = `${frontendUrl}/invites/verify?token=${token}&verify=${verifyToken}`;

    try {
      await this.notificationsService.sendNotification(
        'organization-invite-verification',
        { type: 'email', email },
        {
          firstName: data.name,
          verificationUrl,
          organizationName: organization.name,
        },
      );
    } catch (error) {
      this.logger.error(`Failed to send verification email to ${data.email}`, error);
      throw new InviteValidationException('Failed to send verification email');
    }

    return {
      message: `Verification email sent to ${data.email}`,
      email,
    };
  }

  /**
   * Verify email and accept invitation
   */
  async verifyAndAcceptInvite(inviteToken: string, verifyToken: string) {
    // Validate invitation
    const invite = await this.validateInvite(inviteToken);

    // Validate verification token
    const verification = await this.prisma.inviteEmailVerification.findUnique({
      where: { token: verifyToken },
    });

    if (!verification) {
      throw new EmailVerificationNotFoundException();
    }

    // Check if verification belongs to this invitation
    if (verification.inviteId !== invite.id) {
      throw new EmailVerificationNotFoundException();
    }
    this.assertInviteEmail(invite.email, verification.email);

    // Check if verification is expired
    if (this.isVerificationExpired(verification.expiresAt)) {
      throw new EmailVerificationExpiredException();
    }

    // Check if verification already used
    if (verification.usedAt) {
      throw new EmailVerificationAlreadyUsedException();
    }

    // Check if user account exists to check limits
    const existingUser = await this.prisma.user.findUnique({
      where: { email: verification.email },
      select: { id: true },
    });

    if (existingUser) {
      // Enforce maximum of 10 organizations per user
      const userOrganizationsCount = await this.prisma.organizationMember.count({
        where: { userId: existingUser.id },
      });

      if (userOrganizationsCount >= 10) {
        // Check if user is already a member
        const isMember = await this.prisma.organizationMember.findUnique({
          where: {
            userId_organizationId: {
              userId: existingUser.id,
              organizationId: invite.organizationId,
            },
          },
        });
        if (!isMember) {
          throw new InviteValidationException(
            'You have reached the maximum limit of 10 organizations.',
          );
        }
      }
    }

    // Get organization info
    const organization = await this.prisma.organization.findUnique({
      where: { id: invite.organizationId },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });

    if (!organization) {
      throw new InviteValidationException('Organization not found');
    }

    // Use transaction for atomicity
    const result = await this.prisma.$transaction(async (tx) => {
      await this.claimInvite(tx, invite.id, invite.organizationId);
      const claimedVerification = await tx.inviteEmailVerification.updateMany({
        where: { id: verification.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (claimedVerification.count !== 1) {
        throw new EmailVerificationAlreadyUsedException();
      }
      // Use upsert to handle race conditions - this won't abort the transaction
      // Check if user exists first to determine if it's a new user
      const existingUser = await tx.user.findUnique({
        where: { email: verification.email },
        select: { id: true, emailVerifiedAt: true },
      });

      const isNewUser = !existingUser;

      // Use upsert to create or update user
      const user = await tx.user.upsert({
        where: { email: verification.email },
        create: {
          email: verification.email,
          name: verification.name,
          emailVerifiedAt: new Date(),
        },
        update: {
          // Update emailVerifiedAt if not already set
          emailVerifiedAt: existingUser?.emailVerifiedAt || new Date(),
        },
      });

      // Check if user is already a organization member
      const existingMembership = await tx.organizationMember.findUnique({
        where: {
          userId_organizationId: {
            userId: user.id,
            organizationId: invite.organizationId,
          },
        },
      });

      const membership = await tx.organizationMember.upsert({
        where: {
          userId_organizationId: { userId: user.id, organizationId: invite.organizationId },
        },
        create: {
          userId: user.id,
          organizationId: invite.organizationId,
          role: invite.invitedRole,
        },
        update: {},
      });

      return { user, isNewUser, existingMembership, membership };
    });

    // Generate JWT tokens for automatic login
    const tokens = await this.authService.generateTokens({
      id: result.user.id,
      email: result.user.email,
    });

    const message = result.isNewUser
      ? 'Account created and added to organization'
      : result.existingMembership
        ? 'You are already a member of this organization'
        : 'Added to organization';

    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
      },
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
      },
      role: result.membership.role as OrgRole,
      authToken: tokens.accessToken,
      message,
      isNewUser: result.isNewUser,
    };
  }
}
