import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer className="border-t bg-card/50 mt-16">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          <div>
            <h4 className="font-semibold mb-4">Quick Links</h4>
            <ul className="space-y-2 text-muted-foreground">
              <li><Link to="/" className="hover:text-foreground transition-colors">Home</Link></li>
              <li><Link to="/chat" className="hover:text-foreground transition-colors">Start Chatting</Link></li>
              <li><Link to="/about" className="hover:text-foreground transition-colors">About Us</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Legal</h4>
            <ul className="space-y-2 text-muted-foreground">
              <li><Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link></li>
              <li><Link to="/terms" className="hover:text-foreground transition-colors">Terms & Conditions</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Support</h4>
            <ul className="space-y-2 text-muted-foreground">
              <li><Link to="/contact" className="hover:text-foreground transition-colors">Contact Us</Link></li>
              <li><Link to="/safety" className="hover:text-foreground transition-colors">Safety Tips</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Connect</h4>
            <p className="text-muted-foreground text-sm">Join our global community of anonymous chatters. Connect with strangers worldwide.</p>
          </div>
        </div>
        <div className="text-center text-muted-foreground border-t pt-8">
          <p>&copy; {new Date().getFullYear()} StrangerChat. All rights reserved.</p>
          <p className="text-xs mt-2">
            <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
            {' • '}
            <Link to="/terms" className="hover:text-foreground">Terms</Link>
            {' • '}
            <Link to="/contact" className="hover:text-foreground">Contact</Link>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;