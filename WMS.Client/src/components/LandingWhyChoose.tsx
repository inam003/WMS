import warehouseArtwork from '../references/Why Choose Our WMS section.png';
import './LandingWhyChoose.css';

const benefits = [
  { icon: 'rocket', title: 'Boost Productivity', lines: ['Automate routine tasks and', 'get more done.'] },
  { icon: 'cube', title: 'Real-Time Inventory', lines: ['Know what you have,', "where it is, and what's next."] },
  { icon: 'chart', title: 'Optimize Operations', lines: ['Improve workflows and', 'make data-driven decisions.'] },
  { icon: 'shield', title: 'Enhance Accuracy', lines: ['Reduce errors and', 'keep your operations reliable.'] },
  { icon: 'cost', title: 'Cut Costs', lines: ['Minimize waste and', 'maximize resources.'] },
  { icon: 'clock', title: 'Scale with Confidence', lines: ['A flexible solution that', 'grows with your business.'] },
];

function BenefitIcon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      {name === 'rocket' && <><path d="M13 24c4-12 10-18 23-20-1 13-8 22-19 25l-4-5Z" /><circle cx="26" cy="13" r="3" /><path d="m15 17-7 1-5 6 10 1m10 0-1 9-6 3-1-8M10 28l-5 7 7-3" /></>}
      {name === 'cube' && <><path d="m20 3 16 9v17l-16 9-16-9V12L20 3Z" /><path d="m4 12 16 9 16-9M20 21v17M12 8l16 9m-12-6 4-2 4 2" /></>}
      {name === 'chart' && <><path d="M4 28h6v9H4Zm12-6h6v15h-6Zm12-6h6v21h-6Z" /><path d="m4 20 10-9 8 4L34 3m-8 0h8v8" /></>}
      {name === 'shield' && <><path d="M20 3c5 3 10 5 15 5v12c0 8-7 14-15 18C12 34 5 28 5 20V8c5 0 10-2 15-5Z" /><path d="m13 20 5 5 10-12" /></>}
      {name === 'cost' && <><circle cx="20" cy="20" r="17" /><path d="M25 13c-2-4-11-3-10 2 0 5 11 4 11 10 0 6-10 7-13 1m7-19v4m0 18v4" /></>}
      {name === 'clock' && <><circle cx="20" cy="20" r="17" /><path d="M20 9v12l8 5" /></>}
    </svg>
  );
}

export function LandingWhyChoose() {
  return (
    <section id="why-choose" className="landing-why" aria-labelledby="why-choose-title">
      <figure className="landing-why-artwork">
        <img src={warehouseArtwork} alt="Warehouse worker checking inventory on a tablet. The accuracy and speed badges are illustrative figures from the design concept, not measured customer results." loading="lazy" decoding="async" />
      </figure>
      <div className="landing-why-copy">
        <div className="landing-why-eyebrow"><span>Why Choose Our WMS</span></div>
        <h2 id="why-choose-title"><span>A Smarter Way to</span><span>Manage Your Warehouse</span></h2>
        <p className="landing-why-description">Our Warehouse Management System helps you work more efficiently, reduce operational costs, and gain full visibility over your inventory.</p>
        <div className="landing-why-cards">
          {benefits.map(({ icon, title, lines }) => (
            <article key={title} className="landing-why-card">
              <div className="landing-why-icon" aria-hidden="true"><BenefitIcon name={icon} /></div>
              <div><h3>{title}</h3><p>{lines.map((line, index) => <span key={line}>{index > 0 && ' '}{line}</span>)}</p></div>
            </article>
          ))}
        </div>
      </div>
      <div className="landing-why-dots" aria-hidden="true" />
    </section>
  );
}
