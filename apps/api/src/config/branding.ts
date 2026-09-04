/**
 * Branding configuration for the Onboarding Brain API
 *
 * This file centralizes all branding-related strings and values.
 * Used for easy rebranding and future localization/i18n support.
 */

export const branding = {
  /**
   * Application name
   */
  appName: 'Onboarding Brain',

  /**
   * Email configuration
   */
  email: {
    /**
     * Email addresses
     */
    addresses: {
      from: 'noreply@onboarding-brain.local',
      support: 'support@onboarding-brain.local',
      domain: 'onboarding-brain.local',
    },

    /**
     * Default sender names
     */
    fromName: 'Onboarding Brain',
    fromNameDev: 'Onboarding Brain Dev',

    /**
     * Logo and alt text
     */
    logo: {
      altText: 'Onboarding Brain Logo',
      defaultAltText: 'Organization Logo',
    },

    /**
     * Email template text
     */
    templates: {
      defaultTitle: 'Onboarding Brain',
      copyright: (year: number) => `© ${year} Onboarding Brain. All rights reserved.`,
      helpText: (contactEmail: string) => `Need help? Contact us at ${contactEmail}`,
    },
  },

  /**
   * Email subject lines
   */
  emailSubjects: {
    verification: 'Verify your Onboarding Brain email address',
    passwordReset: 'Onboarding Brain - Password Reset Request',
    otpVerification: 'Your Onboarding Brain Verification Code',
    userInvitation: (organizationName: string) =>
      `You're invited to join ${organizationName} on Onboarding Brain`,
    invitationAccepted: (organizationName: string) =>
      `Welcome to ${organizationName} on Onboarding Brain`,
  },

  /**
   * Email body text
   */
  emailBody: {
    verification: {
      greeting: (firstName: string) => `Hi ${firstName},`,
      signupThanks: 'Thank you for signing up for Onboarding Brain!',
      verifyPrompt: 'Please verify your email address by clicking the button below:',
      ignoreNotice:
        "If you didn't create an Onboarding Brain account, you can safely ignore this email.",
    },
    passwordReset: {
      resetPrompt:
        'We received a request to reset your Onboarding Brain password. If you made this request, click the button below to reset it:',
    },
    otpVerification: {
      codePrompt: 'Your Onboarding Brain verification code is:',
    },
    userInvitation: {
      invitationText: (inviterName: string, organizationName: string, roleName: string) =>
        `${inviterName} has invited you to join ${organizationName} on Onboarding Brain as a ${roleName}.`,
      welcomeText: 'Welcome to Onboarding Brain!',
    },
    invitationAccepted: {
      welcomeText: (organizationName: string, roleName: string) =>
        `You have joined ${organizationName} on Onboarding Brain as a ${roleName}.`,
    },
  },

  /**
   * Service defaults
   */
  service: {
    defaultOrganizationName: 'Onboarding Brain',
  },

  /**
   * Frontend URLs
   */
  urls: {
    frontend: process.env.FRONTEND_URL || 'http://localhost:3000',
  },
} as const;

/**
 * Type-safe branding access
 */
export type Branding = typeof branding;
