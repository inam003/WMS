import { Link } from 'react-router-dom';
import logo from '../assets/logo-open.png';
import heroArtwork from '../references/Hero section.png';
import './LandingHero.css';

const navigation = [
  ['Features', '#key-features'],
  ['How It Works', '#how-it-works'],
  ['Benefits', '#business-benefits'],
  ['FAQs', '#faqs'],
];

const highlights = [
  ['Inventory Control', 'Real-time stock visibility'],
  ['Order Management', 'Faster, more accurate fulfillment'],
  ['Warehouse Operations', 'Streamlined and efficient'],
  ['Scalable Solution', 'Built for growing businesses'],
];

export function LandingHeader() {
  return (
    <header className="landing-header">
      <a className="landing-wordmark" href="#hero" aria-label="WMS home"><img className="landing-logo" src={logo} alt="WMS" /></a>
      <nav className="landing-navigation" aria-label="Main navigation">
        {navigation.map(([label, href]) => <a key={href} href={href}>{label}</a>)}
      </nav>
      <Link className="landing-dark-button landing-login" to="/auth/sign-in">Log in</Link>
    </header>
  );
}

export function LandingHero() {
  return (
    <section id="hero" className="landing-hero" aria-labelledby="hero-title">
      {/* Clip the supplied composition to its artwork; render the copy as live HTML. */}
      <img className="landing-hero-artwork" src={heroArtwork} alt="" aria-hidden="true" fetchPriority="high" />
      <div className="landing-hero-main">
        <div className="landing-hero-copy">
          <p className="landing-hero-eyebrow">Warehouse Management System</p>
          <h1 id="hero-title">Smarter Warehouse<br />Operations<span>for Growing Businesses</span></h1>
          <p className="landing-hero-description">A modern warehouse management system to help you manage inventory, streamline operations, and keep your business moving.</p>
          <div className="landing-hero-actions">
            <Link className="landing-dark-button landing-get-started" to="/auth/sign-in">
              Get Started
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6" /></svg>
            </Link>
          </div>
          <div className="landing-hero-highlights">
            {highlights.map(([title, description]) => (
              <div key={title} className="landing-hero-highlight"><h2>{title}</h2><p>{description}</p></div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
