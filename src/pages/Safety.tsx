import { Link } from 'react-router-dom';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MessageCircle, ArrowLeft, Shield, AlertTriangle, Eye, Lock, UserX, Flag, Heart, CheckCircle } from 'lucide-react';

const Safety = () => {
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

        <div className="text-center mb-12">
          <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-4">Safety Tips</h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Your safety is our top priority. Follow these guidelines to have a positive and secure experience on StrangerChat.
          </p>
        </div>

        <article className="prose prose-lg dark:prose-invert max-w-none">
          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-6 flex items-center gap-3">
              <Lock className="w-6 h-6 text-primary" />
              Protecting Your Privacy
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-l-4 border-l-green-500">
                <CardContent className="pt-6">
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    Do: Stay Anonymous
                  </h3>
                  <p className="text-muted-foreground">Use a nickname that doesn't reveal your real identity. This is one of the best features of StrangerChat—embrace it!</p>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-red-500">
                <CardContent className="pt-6">
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                    Don't: Share Personal Info
                  </h3>
                  <p className="text-muted-foreground">Never share your real name, address, phone number, school/workplace, or any identifying details.</p>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-green-500">
                <CardContent className="pt-6">
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    Do: Keep Social Media Private
                  </h3>
                  <p className="text-muted-foreground">Don't share your social media handles. If someone asks, politely decline or skip to the next person.</p>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-red-500">
                <CardContent className="pt-6">
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                    Don't: Send Money or Gift Cards
                  </h3>
                  <p className="text-muted-foreground">Never send money, cryptocurrency, or gift cards to anyone you meet online, no matter the reason they give.</p>
                </CardContent>
              </Card>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-6 flex items-center gap-3">
              <Eye className="w-6 h-6 text-primary" />
              Recognizing Red Flags
            </h2>
            <p className="text-muted-foreground mb-6">
              Be alert to these warning signs that may indicate harmful intentions:
            </p>
            <ul className="space-y-4">
              <li className="flex gap-3 items-start">
                <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-1" />
                <div>
                  <strong>Requesting Personal Information:</strong>
                  <span className="text-muted-foreground"> Anyone persistently asking for your real name, location, or contact details should be avoided.</span>
                </div>
              </li>
              <li className="flex gap-3 items-start">
                <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-1" />
                <div>
                  <strong>Asking for Photos or Videos:</strong>
                  <span className="text-muted-foreground"> Be cautious of anyone asking you to share personal photos, especially intimate ones.</span>
                </div>
              </li>
              <li className="flex gap-3 items-start">
                <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-1" />
                <div>
                  <strong>Too Good to Be True:</strong>
                  <span className="text-muted-foreground"> Beware of people offering money, jobs, or special opportunities in exchange for personal info.</span>
                </div>
              </li>
              <li className="flex gap-3 items-start">
                <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-1" />
                <div>
                  <strong>Pressure and Urgency:</strong>
                  <span className="text-muted-foreground"> Anyone pressuring you to do something quickly or secretly is likely not trustworthy.</span>
                </div>
              </li>
              <li className="flex gap-3 items-start">
                <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-1" />
                <div>
                  <strong>External Links:</strong>
                  <span className="text-muted-foreground"> Be wary of clicking links shared by strangers—they may lead to malicious websites.</span>
                </div>
              </li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-6 flex items-center gap-3">
              <UserX className="w-6 h-6 text-primary" />
              Dealing with Uncomfortable Situations
            </h2>
            <Card className="bg-muted/50 mb-6">
              <CardContent className="pt-6">
                <p className="text-lg font-medium mb-4">Remember: You are always in control.</p>
                <p className="text-muted-foreground">
                  If a conversation makes you uncomfortable for any reason, you have every right to leave immediately. There's no obligation to explain or continue chatting.
                </p>
              </CardContent>
            </Card>
            <div className="space-y-4">
              <div className="flex gap-4 p-4 bg-card rounded-lg border">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-lg font-bold text-primary">1</span>
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Click "Next" Immediately</h3>
                  <p className="text-muted-foreground">Don't engage with inappropriate behavior. Simply skip to the next person.</p>
                </div>
              </div>
              <div className="flex gap-4 p-4 bg-card rounded-lg border">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-lg font-bold text-primary">2</span>
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Don't Respond to Harassment</h3>
                  <p className="text-muted-foreground">Engaging with harassers only encourages them. Ignore and move on.</p>
                </div>
              </div>
              <div className="flex gap-4 p-4 bg-card rounded-lg border">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-lg font-bold text-primary">3</span>
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Take a Break if Needed</h3>
                  <p className="text-muted-foreground">If you encounter multiple negative experiences, it's okay to step away and return later.</p>
                </div>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-6 flex items-center gap-3">
              <Flag className="w-6 h-6 text-primary" />
              Reporting Violations
            </h2>
            <p className="text-muted-foreground mb-4">
              Help us maintain a safe community by reporting users who violate our guidelines. You can report someone for:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-6">
              <li>Harassment or bullying</li>
              <li>Sharing inappropriate or explicit content</li>
              <li>Attempting to gather personal information</li>
              <li>Scam or fraudulent behavior</li>
              <li>Threats or violent content</li>
              <li>Hate speech or discrimination</li>
              <li>Spam or commercial advertising</li>
            </ul>
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="pt-6">
                <p className="font-medium mb-2">How to Report:</p>
                <p className="text-muted-foreground">Email us at <a href="mailto:report@strangerchat.live" className="text-primary hover:underline">report@strangerchat.live</a> with details about the incident. Include the time and any relevant information about the conversation.</p>
              </CardContent>
            </Card>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-6 flex items-center gap-3">
              <Heart className="w-6 h-6 text-primary" />
              Mental Health & Wellbeing
            </h2>
            <p className="text-muted-foreground mb-4">
              Online interactions can sometimes affect our mental wellbeing. Here are some tips:
            </p>
            <ul className="space-y-3 text-muted-foreground">
              <li className="flex gap-2 items-start">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <span>Set time limits for how long you spend chatting online</span>
              </li>
              <li className="flex gap-2 items-start">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <span>Remember that not everyone you meet represents all people</span>
              </li>
              <li className="flex gap-2 items-start">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <span>Take breaks when needed—your wellbeing comes first</span>
              </li>
              <li className="flex gap-2 items-start">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <span>Talk to trusted friends or family if you experience something upsetting</span>
              </li>
              <li className="flex gap-2 items-start">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <span>If you're struggling, consider reaching out to mental health resources in your area</span>
              </li>
            </ul>
          </section>

          <section className="mb-12 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-2xl p-8">
            <h2 className="text-2xl font-semibold mb-4 text-center">Stay Safe, Have Fun!</h2>
            <p className="text-muted-foreground text-center mb-6">
              Following these guidelines will help ensure a positive experience for you and everyone in our community. StrangerChat can be a wonderful place to meet interesting people—just be smart about protecting yourself.
            </p>
            <div className="flex justify-center">
              <Link to="/chat">
                <Button size="lg" className="gap-2">
                  <MessageCircle className="w-5 h-5" />
                  Start Chatting Safely
                </Button>
              </Link>
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

export default Safety;