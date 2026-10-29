import { Navigate } from 'react-router-dom';
import { neon } from '../lib/neon';
import { LandingHeader, LandingHero } from '../components/LandingHero';
import { LandingWhyChoose } from '../components/LandingWhyChoose';
import { LandingKeyFeatures } from '../components/LandingKeyFeatures';
import { LandingHowItWorks } from '../components/LandingHowItWorks';
import { LandingBusinessBenefits } from '../components/LandingBusinessBenefits';
import { LandingClosingSections } from '../components/LandingClosingSections';
import '../components/LandingTheme.css';

export function LandingEntry() {
  const session = neon.auth.useSession();
  if (session.data?.user) return <Navigate to="/dashboard" replace />;
  return <LandingPage />;
}

function LandingPage() {
  return (
    <div className="landing-page">
      <LandingHeader />
      <main>
        <LandingHero />
        <LandingWhyChoose />
        <LandingKeyFeatures />
        <LandingHowItWorks />
        <LandingBusinessBenefits />
      </main>
      <LandingClosingSections />
    </div>
  );
}
