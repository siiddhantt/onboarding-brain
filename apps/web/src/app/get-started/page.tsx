import type { Metadata } from 'next';
import { GetStartedGuide } from '@/components/landing/GetStartedGuide';

export const metadata: Metadata = {
  title: 'Get started · Onboarding Brain',
  description: 'Create an account, set up an organization, and invite your team.',
};

const GetStartedPage = () => <GetStartedGuide />;

export default GetStartedPage;
