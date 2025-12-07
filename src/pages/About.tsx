import { Link } from 'react-router-dom';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MessageCircle, ArrowLeft, Globe, Shield, Users, Heart, Zap, Lock } from 'lucide-react';

const About = () => {
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
          <h1 className="text-3xl sm:text-4xl font-bold mb-6">About StrangerChat</h1>
          
          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4">Our Mission</h2>
            <p className="text-muted-foreground leading-relaxed text-lg">
              At StrangerChat, we believe that meaningful connections can happen anywhere, with anyone. Our mission is to create a safe, anonymous platform where people from all walks of life can come together to share ideas, make friends, and experience the joy of spontaneous human connection—without the pressure of social media profiles or lasting digital footprints.
            </p>
            <p className="text-muted-foreground leading-relaxed text-lg mt-4">
              In an increasingly connected yet isolated world, we provide a space where conversations flow naturally, where you can be yourself without judgment, and where every chat is a new adventure. Whether you're looking to discuss deep topics, share a laugh, learn about different cultures, or simply pass the time, StrangerChat is your gateway to authentic human interaction.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-6">What Makes Us Different</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="p-6">
                <CardContent className="p-0">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center mb-4">
                    <Lock className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">True Anonymity</h3>
                  <p className="text-muted-foreground">No registration required. No email verification. No personal data collection. Just pick a username and start chatting instantly.</p>
                </CardContent>
              </Card>

              <Card className="p-6">
                <CardContent className="p-0">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center mb-4">
                    <Zap className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Instant Connections</h3>
                  <p className="text-muted-foreground">Our smart matching system connects you with available users in real-time. No waiting, no queues—just immediate conversations.</p>
                </CardContent>
              </Card>

              <Card className="p-6">
                <CardContent className="p-0">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center mb-4">
                    <Globe className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Global Community</h3>
                  <p className="text-muted-foreground">Connect with people from every corner of the world. Learn about different cultures, perspectives, and ways of life through real conversations.</p>
                </CardContent>
              </Card>

              <Card className="p-6">
                <CardContent className="p-0">
                  <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center mb-4">
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Safe Environment</h3>
                  <p className="text-muted-foreground">We're committed to maintaining a respectful community. Our guidelines ensure positive interactions for everyone.</p>
                </CardContent>
              </Card>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4">Our Story</h2>
            <p className="text-muted-foreground leading-relaxed">
              StrangerChat was born from a simple observation: despite having hundreds of friends on social media, many people feel more isolated than ever. The curated nature of online identities creates pressure to present a perfect image, making genuine connection increasingly rare.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-4">
              We created StrangerChat to bring back the magic of spontaneous conversation. Remember striking up a conversation with a stranger on a train, in a coffee shop, or at an event? Those unplanned moments often lead to the most memorable interactions. StrangerChat recreates that experience in the digital world.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-4">
              Since our launch, we've facilitated millions of conversations between people who would never have met otherwise. From students finding study partners across continents to travelers getting local tips, from people seeking advice to those simply looking for a friendly chat—our platform has become a hub for authentic human connection.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4">How StrangerChat Works</h2>
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold">1</div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Choose Your Username</h3>
                  <p className="text-muted-foreground">Pick any name you like. It can be your nickname, a fun alias, or anything that represents you in that moment. No real names required.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold">2</div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Get Matched Instantly</h3>
                  <p className="text-muted-foreground">Our system automatically pairs you with another available user. Within seconds, you'll be in a private one-on-one conversation.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold">3</div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Start Chatting</h3>
                  <p className="text-muted-foreground">Share messages, images, and ideas in real-time. The conversation is yours to shape however you like.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold">4</div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Move On Anytime</h3>
                  <p className="text-muted-foreground">Ready for a new conversation? Click "Next" to be matched with someone new. There's always another interesting person waiting to chat.</p>
                </div>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4">Our Values</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <Users className="w-12 h-12 text-primary mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Inclusivity</h3>
                <p className="text-muted-foreground">Everyone is welcome here, regardless of background, location, or identity.</p>
              </div>
              <div className="text-center">
                <Shield className="w-12 h-12 text-primary mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Safety</h3>
                <p className="text-muted-foreground">We prioritize creating a safe space for authentic, respectful interactions.</p>
              </div>
              <div className="text-center">
                <Heart className="w-12 h-12 text-primary mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Connection</h3>
                <p className="text-muted-foreground">Human connection is at the heart of everything we do.</p>
              </div>
            </div>
          </section>

          <section className="mb-12 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-2xl p-8 text-center">
            <h2 className="text-2xl font-semibold mb-4">Ready to Start Chatting?</h2>
            <p className="text-muted-foreground mb-6">Join our global community and start making connections today.</p>
            <Link to="/chat">
              <Button size="lg" className="gap-2">
                <MessageCircle className="w-5 h-5" />
                Start Your First Chat
              </Button>
            </Link>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              We love hearing from our community. Whether you have suggestions, questions, or just want to say hello, feel free to reach out.
            </p>
            <div className="bg-muted/50 rounded-lg p-4 mt-4">
              <p className="text-foreground font-medium">StrangerChat Team</p>
              <p className="text-muted-foreground">Email: hello@strangerchat.live</p>
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

export default About;