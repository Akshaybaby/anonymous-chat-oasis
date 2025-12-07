import { Link } from 'react-router-dom';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Button } from '@/components/ui/button';
import { MessageCircle, ArrowLeft } from 'lucide-react';

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link to="/" className="flex items-center gap-4">
            <h1 className="text-2xl sm:text-4xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Stranger
              </span>
              <span className="bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 bg-clip-text text-transparent ml-1">
                Chat
              </span>
            </h1>
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link to="/chat">
              <Button variant="light-blue" size="sm" className="gap-2">
                <MessageCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Start Chatting</span>
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        <article className="prose prose-lg dark:prose-invert max-w-none">
          <h1 className="text-3xl sm:text-4xl font-bold mb-6">Privacy Policy</h1>
          <p className="text-muted-foreground mb-8">Last Updated: December 7, 2024</p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
            <p className="text-muted-foreground leading-relaxed">
              Welcome to StrangerChat ("we," "our," or "us"). We are committed to protecting your privacy and ensuring a safe, anonymous chatting experience. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website strangerchat.live and use our services.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-4">
              By accessing or using StrangerChat, you agree to the terms of this Privacy Policy. If you do not agree with the practices described in this policy, please do not use our services.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">2. Information We Collect</h2>
            
            <h3 className="text-xl font-medium mb-3">2.1 Information You Provide</h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li><strong>Username:</strong> A temporary, anonymous username you choose when entering the chat. This is not linked to any personal identity.</li>
              <li><strong>Chat Messages:</strong> The content of messages you send during chat sessions. These are temporarily stored for real-time delivery.</li>
              <li><strong>Media Files:</strong> Images or files you choose to share during conversations.</li>
            </ul>

            <h3 className="text-xl font-medium mb-3 mt-6">2.2 Automatically Collected Information</h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li><strong>Device Information:</strong> Browser type, operating system, and device identifiers.</li>
              <li><strong>Usage Data:</strong> Pages visited, time spent on pages, and interaction patterns.</li>
              <li><strong>IP Address:</strong> Collected for security purposes and to prevent abuse.</li>
              <li><strong>Cookies:</strong> Small data files stored on your device to enhance your experience.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">3. How We Use Your Information</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">We use the information we collect to:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Provide and maintain our anonymous chat services</li>
              <li>Match you with other users for conversations</li>
              <li>Deliver messages and media in real-time</li>
              <li>Prevent abuse, spam, and violations of our Terms of Service</li>
              <li>Improve and optimize our platform's performance</li>
              <li>Analyze usage patterns to enhance user experience</li>
              <li>Comply with legal obligations and protect our rights</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">4. Cookies and Tracking Technologies</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We use cookies and similar tracking technologies to collect and store information about your interactions with our website.
            </p>
            
            <h3 className="text-xl font-medium mb-3">Types of Cookies We Use:</h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li><strong>Essential Cookies:</strong> Required for the website to function properly, including session management.</li>
              <li><strong>Analytics Cookies:</strong> Help us understand how visitors interact with our website.</li>
              <li><strong>Advertising Cookies:</strong> Used by our advertising partners (including Google AdSense) to deliver relevant advertisements.</li>
              <li><strong>Preference Cookies:</strong> Remember your settings and preferences (such as theme choice).</li>
            </ul>

            <h3 className="text-xl font-medium mb-3 mt-6">Google AdSense</h3>
            <p className="text-muted-foreground leading-relaxed">
              We use Google AdSense to display advertisements on our website. Google may use cookies to serve ads based on your prior visits to our website or other websites. You can opt out of personalized advertising by visiting <a href="https://www.google.com/settings/ads" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">Google Ads Settings</a>.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">5. Data Retention</h2>
            <p className="text-muted-foreground leading-relaxed">
              We retain your information only for as long as necessary to provide our services:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-4">
              <li><strong>Chat Messages:</strong> Deleted when you leave the chat session or within 24 hours of inactivity.</li>
              <li><strong>Session Data:</strong> Cleared when you close your browser or leave the platform.</li>
              <li><strong>Usage Analytics:</strong> Aggregated and anonymized data may be retained for analysis purposes.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">6. Data Security</h2>
            <p className="text-muted-foreground leading-relaxed">
              We implement appropriate technical and organizational security measures to protect your information against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the Internet is 100% secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">7. Third-Party Services</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We may share information with third-party service providers who assist us in operating our website:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li><strong>Google AdSense:</strong> For displaying advertisements</li>
              <li><strong>Supabase:</strong> For database and real-time messaging services</li>
              <li><strong>Analytics Providers:</strong> For understanding website usage</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              These third parties have their own privacy policies governing the use of your information.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">8. Your Rights</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">Depending on your location, you may have the following rights:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Access the personal information we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Object to or restrict processing of your data</li>
              <li>Data portability</li>
              <li>Withdraw consent at any time</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              To exercise these rights, please contact us using the information provided below.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">9. Children's Privacy</h2>
            <p className="text-muted-foreground leading-relaxed">
              StrangerChat is not intended for children under 18 years of age. We do not knowingly collect personal information from children. If we learn that we have collected information from a child under 18, we will delete that information promptly.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">10. International Users</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you are accessing our services from outside the country where our servers are located, please be aware that your information may be transferred to, stored, and processed in a different jurisdiction. By using our services, you consent to this transfer.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">11. Changes to This Privacy Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date. We encourage you to review this Privacy Policy periodically.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">12. Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have any questions about this Privacy Policy or our data practices, please contact us at:
            </p>
            <div className="bg-muted/50 rounded-lg p-4 mt-4">
              <p className="text-foreground font-medium">StrangerChat</p>
              <p className="text-muted-foreground">Email: privacy@strangerchat.live</p>
              <p className="text-muted-foreground">Website: strangerchat.live</p>
            </div>
          </section>
        </article>
      </div>

      {/* Footer */}
      <footer className="border-t bg-card/50 mt-16">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h4 className="font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2 text-muted-foreground">
                <li><Link to="/" className="hover:text-foreground">Home</Link></li>
                <li><Link to="/chat" className="hover:text-foreground">Start Chatting</Link></li>
                <li><Link to="/about" className="hover:text-foreground">About Us</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-muted-foreground">
                <li><Link to="/privacy" className="hover:text-foreground">Privacy Policy</Link></li>
                <li><Link to="/terms" className="hover:text-foreground">Terms & Conditions</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-muted-foreground">
                <li><Link to="/contact" className="hover:text-foreground">Contact Us</Link></li>
                <li><Link to="/safety" className="hover:text-foreground">Safety Tips</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Connect</h4>
              <p className="text-muted-foreground text-sm">Join our global community of anonymous chatters.</p>
            </div>
          </div>
          <div className="text-center text-muted-foreground border-t pt-8">
            <p>&copy; 2024 StrangerChat. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PrivacyPolicy;