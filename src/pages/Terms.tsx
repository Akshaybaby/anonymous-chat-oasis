import { Link } from 'react-router-dom';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Button } from '@/components/ui/button';
import { MessageCircle, ArrowLeft } from 'lucide-react';

const Terms = () => {
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
          <h1 className="text-3xl sm:text-4xl font-bold mb-6">Terms and Conditions</h1>
          <p className="text-muted-foreground mb-8">Last Updated: December 7, 2024</p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">1. Agreement to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              Welcome to StrangerChat. These Terms and Conditions ("Terms") govern your access to and use of the StrangerChat website located at strangerchat.live ("Service"). By accessing or using our Service, you agree to be bound by these Terms. If you disagree with any part of these Terms, you may not access the Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">2. Description of Service</h2>
            <p className="text-muted-foreground leading-relaxed">
              StrangerChat is a free, anonymous online chat platform that enables users to connect with random strangers for text-based conversations. Our Service includes:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-4">
              <li>One-on-one private chat sessions with randomly matched users</li>
              <li>Group chat rooms for community conversations</li>
              <li>AI-powered chatbot conversations when no users are available</li>
              <li>Media sharing capabilities within chat sessions</li>
              <li>Real-time messaging functionality</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">3. Eligibility</h2>
            <p className="text-muted-foreground leading-relaxed">
              You must be at least 18 years of age to use StrangerChat. By using our Service, you represent and warrant that you are at least 18 years old and have the legal capacity to enter into these Terms. If you are using the Service on behalf of an organization, you represent that you have the authority to bind that organization to these Terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">4. User Conduct</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              When using StrangerChat, you agree NOT to:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Share, post, or transmit any content that is illegal, harmful, threatening, abusive, harassing, defamatory, vulgar, obscene, or otherwise objectionable</li>
              <li>Engage in any form of harassment, bullying, or intimidation of other users</li>
              <li>Share sexually explicit content, nudity, or pornographic material</li>
              <li>Promote violence, discrimination, or hatred against any individual or group</li>
              <li>Share personal information of others without their consent</li>
              <li>Attempt to impersonate another person or entity</li>
              <li>Use the Service for any commercial purposes or advertising without permission</li>
              <li>Attempt to hack, exploit, or compromise the security of our Service</li>
              <li>Use automated systems or bots to access the Service</li>
              <li>Violate any applicable local, state, national, or international law</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">5. Content Guidelines</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              All content shared on StrangerChat must comply with the following guidelines:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li><strong>No Adult Content:</strong> Sexually explicit material is strictly prohibited</li>
              <li><strong>No Violence:</strong> Content promoting or depicting violence is not allowed</li>
              <li><strong>No Hate Speech:</strong> Discriminatory or hateful content based on race, religion, gender, sexual orientation, or other characteristics is forbidden</li>
              <li><strong>No Illegal Activities:</strong> Content promoting illegal activities, including drug use, is prohibited</li>
              <li><strong>No Spam:</strong> Repetitive messages, advertising, or promotional content is not allowed</li>
              <li><strong>Respect Copyright:</strong> Do not share copyrighted material without permission</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">6. Privacy and Anonymity</h2>
            <p className="text-muted-foreground leading-relaxed">
              While StrangerChat provides anonymous chatting, we encourage users to protect their privacy by not sharing personal identifying information such as real names, addresses, phone numbers, or financial information. We are not responsible for any consequences arising from users voluntarily sharing personal information. Please refer to our <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link> for details on how we handle your data.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">7. Intellectual Property</h2>
            <p className="text-muted-foreground leading-relaxed">
              The StrangerChat name, logo, and all related marks, graphics, and content on this website are the property of StrangerChat or its licensors and are protected by copyright, trademark, and other intellectual property laws. You may not use, reproduce, or distribute any content from our Service without prior written permission.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">8. Disclaimer of Warranties</h2>
            <p className="text-muted-foreground leading-relaxed">
              StrangerChat is provided on an "AS IS" and "AS AVAILABLE" basis without warranties of any kind, either express or implied. We do not guarantee that the Service will be uninterrupted, secure, or error-free. We make no warranties regarding the accuracy, reliability, or quality of any content or communications made through the Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">9. Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">
              To the fullest extent permitted by law, StrangerChat and its owners, operators, employees, and agents shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising out of or related to your use of the Service. This includes, but is not limited to, damages for loss of profits, data, or other intangible losses.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">10. Indemnification</h2>
            <p className="text-muted-foreground leading-relaxed">
              You agree to indemnify, defend, and hold harmless StrangerChat and its affiliates, officers, directors, employees, and agents from any claims, liabilities, damages, losses, and expenses arising from your use of the Service or violation of these Terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">11. Termination</h2>
            <p className="text-muted-foreground leading-relaxed">
              We reserve the right to terminate or suspend your access to the Service immediately, without prior notice, for any reason, including breach of these Terms. Upon termination, your right to use the Service will cease immediately.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">12. Modifications to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              We reserve the right to modify these Terms at any time. We will notify users of any material changes by updating the "Last Updated" date at the top of this page. Your continued use of the Service after any modifications indicates your acceptance of the updated Terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">13. Governing Law</h2>
            <p className="text-muted-foreground leading-relaxed">
              These Terms shall be governed by and construed in accordance with applicable laws, without regard to conflict of law principles. Any disputes arising from these Terms or the Service shall be resolved through binding arbitration or in the courts of competent jurisdiction.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">14. Severability</h2>
            <p className="text-muted-foreground leading-relaxed">
              If any provision of these Terms is found to be unenforceable or invalid, that provision will be limited or eliminated to the minimum extent necessary, and the remaining provisions will continue in full force and effect.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">15. Contact Information</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have any questions about these Terms, please contact us at:
            </p>
            <div className="bg-muted/50 rounded-lg p-4 mt-4">
              <p className="text-foreground font-medium">StrangerChat</p>
              <p className="text-muted-foreground">Email: legal@strangerchat.live</p>
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

export default Terms;