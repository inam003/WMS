import { Link } from 'react-router-dom';
import workflowArtwork from '../references/How It Works section.png';
import './LandingHowItWorks.css';

const steps = [
  {
    title: 'Set Up Your Warehouse',
    lines: ['Add your warehouses, storage', 'locations, products, and', 'categories to get started.'],
    alt: 'Warehouse setup interface with locations and warehouse status.',
    crop: { x: 41, y: 496, width: 275, height: 226 },
  },
  {
    title: 'Receive Stock',
    lines: ['Record incoming stock with', 'barcode scanning and update', 'inventory in real time.'],
    alt: 'Warehouse operator scanning the barcode on an incoming carton.',
    crop: { x: 347, y: 496, width: 254, height: 226 },
  },
  {
    title: 'Track & Manage Inventory',
    lines: ['Get real-time visibility of stock', 'levels, locations, and movement', 'across all warehouses.'],
    alt: 'Inventory interface showing products, quantities, and storage locations.',
    crop: { x: 637, y: 496, width: 277, height: 226 },
  },
  {
    title: 'Process Orders',
    lines: ['Create orders, allocate stock', 'from specific locations, and', 'prepare them for dispatch.'],
    alt: 'Customer order interface with order statuses and a create order action.',
    crop: { x: 943, y: 496, width: 272, height: 226 },
  },
  {
    title: 'Pick, Pack & Dispatch',
    lines: ['Pick items from designated', 'locations, pack them, and mark', 'orders as dispatched.'],
    alt: 'Packed shipment on a conveyor with an illustrative dispatch confirmation.',
    crop: { x: 1246, y: 496, width: 268, height: 226 },
  },
];

function StepPreview({ step }: { step: (typeof steps)[number] }) {
  return (
    <div className="landing-workflow-preview" style={{ aspectRatio: `${step.crop.width} / ${step.crop.height}` }}>
      <img
        src={workflowArtwork}
        alt={step.alt}
        loading="lazy"
        decoding="async"
        style={{
          width: `${1536 / step.crop.width * 100}%`,
          height: `${1024 / step.crop.height * 100}%`,
          left: `${-step.crop.x / step.crop.width * 100}%`,
          top: `${-step.crop.y / step.crop.height * 100}%`,
        }}
      />
    </div>
  );
}

function Arrow() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6" /></svg>;
}

export function LandingHowItWorks() {

  return (
    <section id="how-it-works" className="landing-workflow" aria-labelledby="how-it-works-title">
      <div className="landing-workflow-corner" aria-hidden="true" />
      <header className="landing-workflow-heading">
        <p className="landing-workflow-eyebrow">How It Works</p>
        <h2 id="how-it-works-title">From Receiving to Dispatch,<span>All in One Flow</span></h2>
        <p className="landing-workflow-description">A simple and structured process to manage your warehouse operations<br className="landing-workflow-desktop-break" /> from the moment stock arrives to the time it’s dispatched.</p>
      </header>
      <ol className="landing-workflow-steps">
        {steps.map((step, index) => (
          <li key={step.title} className="landing-workflow-step">
            <div className="landing-workflow-progress" aria-hidden="true">
              <span className="landing-workflow-number">{String(index + 1).padStart(2, '0')}</span>
              <span className="landing-workflow-connector" />
              {index < steps.length - 1 && <span className="landing-workflow-arrow"><Arrow /></span>}
            </div>
            <h3>{step.title}</h3>
            <StepPreview step={step} />
            <p className="landing-workflow-step-description">{step.lines.map((line, lineIndex) => <span key={line}>{lineIndex > 0 && ' '}{line}</span>)}</p>
          </li>
        ))}
      </ol>
      <div className="landing-workflow-actions">
        <Link className="landing-workflow-primary" to="/auth/sign-in">Open WMS<Arrow /></Link>
      </div>
    </section>
  );
}
