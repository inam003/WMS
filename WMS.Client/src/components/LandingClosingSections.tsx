import { Link } from 'react-router-dom';
import logo from '../assets/logo-open.png';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import FactoryOutlinedIcon from '@mui/icons-material/FactoryOutlined';
import WarehouseOutlinedIcon from '@mui/icons-material/WarehouseOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import './LandingClosingSections.css';

const audiences = [
  [<Inventory2OutlinedIcon />, 'Retail & E-commerce', 'Keep stock accurate and orders moving.'],
  [<LocalShippingOutlinedIcon />, 'Logistics & Distribution', 'Handle multiple locations and faster dispatch.'],
  [<FactoryOutlinedIcon />, 'Manufacturing', 'Track raw materials, WIP, and finished goods.'],
  [<WarehouseOutlinedIcon />, 'Wholesale & Trading', 'Manage larger volumes with better visibility.'],
  [<SettingsOutlinedIcon />, '3PL Providers', 'Offer reliable and consistent service levels.'],
  [<WarehouseOutlinedIcon />, 'Growing Businesses', 'Scale operations without adding complexity.'],
] as const;
const faqs = [
  ['How long does it take to set up the system?', 'Setup depends on your warehouse structure, product catalog, locations, and team access requirements. Start by configuring these records before receiving stock.'],
  ['Can the system handle multiple warehouses?', 'Yes. Manage warehouses and storage locations, view stock distribution, and transfer stock between locations.'],
  ['Do you offer training and support?', 'Contact your WMS administrator to discuss onboarding, training, and available support.'],
  ['Is the system suitable for small businesses?', 'The core workflows support teams that need organized products, storage locations, stock movements, and customer orders.'],
  ['What kind of reports can I get?', 'Reports cover current stock, inventory movements, receiving, adjustments, transfers, and orders and dispatch, with CSV export.'],
  ['Can I integrate it with other tools?', 'Integrations require a separate review of your tools and requirements. The current platform provides reports and CSV exports.'],
];

export function LandingClosingSections() {
  return (
    <div className="landing-closing">
      <section id="who-its-for" className="landing-audiences" aria-labelledby="audiences-title">
        <div><p className="closing-eyebrow">Who It’s For</p><h2 id="audiences-title">Built for a Wide Range<span>of Businesses</span></h2><p className="closing-description">From small growing operations to large multi-warehouse networks, our WMS adapts to your business, your team, and your workflow.</p></div>
        <div className="closing-audience-grid">{audiences.map(([icon, title, text]) => <article key={title}><span className="closing-audience-icon" aria-hidden="true">{icon}</span><h3>{title}</h3><p>{text}</p></article>)}</div>
      </section>
      <section id="faqs" className="landing-closing-faqs" aria-labelledby="closing-faq-title">
        <p className="closing-eyebrow">Frequently Asked Questions</p><h2 id="closing-faq-title">Everything You <span>Need to Know</span></h2><p className="closing-description">Got questions? We've got answers. Here are some of the most common<br /> questions about our Warehouse Management System.</p>
        <div className="closing-faq-grid">{[faqs.slice(0, 3), faqs.slice(3)].map((column, index) => <div key={index}>{column.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div>)}</div>
      </section>
      <section className="landing-closing-cta" aria-labelledby="closing-cta-title">
        <p className="closing-eyebrow">Get Started Today</p><h2 id="closing-cta-title">Let’s Build a Smarter Warehouse Together</h2><p className="closing-description">Our team will walk you through your requirements, answer your questions,<br /> and share how the system can work for your business.</p>
        <div><Link className="closing-get-started" to="/auth/sign-in">Get Started <span aria-hidden="true">→</span></Link></div>
      </section>
      <footer className="landing-closing-footer"><p><a href="#hero" aria-label="WMS home"><img className="landing-logo" src={logo} alt="WMS" /></a><span>Warehouse Management System</span></p><p>Smarter inventory. Smoother operations.</p></footer>
    </div>
  );
}
