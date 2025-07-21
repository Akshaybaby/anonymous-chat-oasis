import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MessageCircle, Users, Globe, Heart, Shield, Zap } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Link } from 'react-router-dom';

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-4xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent animate-pulse">
                Stranger
              </span>
              <span className="bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 bg-clip-text text-transparent ml-1">
                Chat
              </span>
            </h1>
            <div className="hidden sm:block text-xs bg-gradient-to-r from-primary/20 to-secondary/20 px-3 py-1 rounded-full border">
              🌍 Connect Worldwide
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link to="/chat">
              <Button size="lg" className="gap-2 bg-gradient-to-r from-primary to-secondary hover:from-primary/80 hover:to-secondary/80">
                <MessageCircle className="w-5 h-5" />
                Start Chatting
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h2 className="text-6xl md:text-7xl font-bold mb-6 tracking-tight">
            Chat <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">Anonymously</span>
          </h2>
          <div className="mb-4">
            <span className="text-2xl md:text-3xl font-semibold bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 bg-clip-text text-transparent">
              StrangerChat
            </span>
            <span className="text-lg text-muted-foreground ml-2">- Anonymous chatting with real people & AI</span>
          </div>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Start private one-to-one conversations or join group chat rooms. Share photos, videos, and connect instantly with strangers worldwide!
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-6">
            <Link to="/chat">
              <Button size="lg" className="text-lg px-8 py-6 gap-3 bg-gradient-to-r from-primary to-secondary hover:from-primary/80 hover:to-secondary/80">
                <MessageCircle className="w-6 h-6" />
                Start Private Chat
              </Button>
            </Link>
            <Link to="/chat">
              <Button variant="outline" size="lg" className="text-lg px-8 py-6 gap-3">
                <Users className="w-6 h-6" />
                Join Chat Rooms
              </Button>
            </Link>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>1000+ people online now</span>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          <Card className="p-6 text-center hover:shadow-lg transition-shadow">
            <CardContent className="p-0">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Globe className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Global Community</h3>
              <p className="text-muted-foreground">Chat with people from every corner of the world and learn about different cultures</p>
            </CardContent>
          </Card>

          <Card className="p-6 text-center hover:shadow-lg transition-shadow">
            <CardContent className="p-0">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Instant Access</h3>
              <p className="text-muted-foreground">No registration, no email verification. Just pick a username and start chatting immediately</p>
            </CardContent>
          </Card>

          <Card className="p-6 text-center hover:shadow-lg transition-shadow">
            <CardContent className="p-0">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Multiple Rooms</h3>
              <p className="text-muted-foreground">Join different chat rooms based on your interests - from casual talk to knowledge sharing</p>
            </CardContent>
          </Card>

          <Card className="p-6 text-center hover:shadow-lg transition-shadow">
            <CardContent className="p-0">
              <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Heart className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Make Friends</h3>
              <p className="text-muted-foreground">Build real relationships and long-term friendships with like-minded people</p>
            </CardContent>
          </Card>

          <Card className="p-6 text-center hover:shadow-lg transition-shadow">
            <CardContent className="p-0">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Safe Environment</h3>
              <p className="text-muted-foreground">Enjoy chatting in a moderated environment designed for positive interactions</p>
            </CardContent>
          </Card>

          <Card className="p-6 text-center hover:shadow-lg transition-shadow">
            <CardContent className="p-0">
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Real-time Chat</h3>
              <p className="text-muted-foreground">Experience seamless real-time messaging with instant message delivery</p>
            </CardContent>
          </Card>
        </div>

        {/* Advertisement Sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          <Card className="p-6 bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-900/20 dark:to-amber-800/20">
            <CardContent className="p-0 text-center">
              <h4 className="font-semibold text-amber-800 dark:text-amber-200 mb-3">Featured</h4>
              <div className="p-8 bg-white/50 dark:bg-black/20 rounded-lg">
                <p className="text-amber-700 dark:text-amber-300">Advertisement Space</p>
                <p className="text-xs mt-2 text-amber-600 dark:text-amber-400">728x90 Leaderboard</p>
              </div>
            </CardContent>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-teal-100 to-teal-200 dark:from-teal-900/20 dark:to-teal-800/20">
            <CardContent className="p-0 text-center">
              <h4 className="font-semibold text-teal-800 dark:text-teal-200 mb-3">Sponsored</h4>
              <div className="p-8 bg-white/50 dark:bg-black/20 rounded-lg">
                <p className="text-teal-700 dark:text-teal-300">Your Brand Here</p>
                <p className="text-xs mt-2 text-teal-600 dark:text-teal-400">728x90 Banner</p>
              </div>
            </CardContent>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-pink-100 to-pink-200 dark:from-pink-900/20 dark:to-pink-800/20">
            <CardContent className="p-0 text-center">
              <h4 className="font-semibold text-pink-800 dark:text-pink-200 mb-3">Promoted</h4>
              <div className="p-8 bg-white/50 dark:bg-black/20 rounded-lg">
                <p className="text-pink-700 dark:text-pink-300">Premium Ads</p>
                <p className="text-xs mt-2 text-pink-600 dark:text-pink-400">728x90 Display</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Goals Section */}
        <div className="text-center mb-16">
          <h3 className="text-3xl font-bold mb-8">Why Choose StrangerChat?</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="text-left">
              <h4 className="text-xl font-semibold mb-3">🌍 Meet New People Online</h4>
              <p className="text-muted-foreground">Connect with amazing people from all over the world and expand your social network.</p>
            </div>
            <div className="text-left">
              <h4 className="text-xl font-semibold mb-3">📚 Share Knowledge</h4>
              <p className="text-muted-foreground">Everyone knows something unique. Share your knowledge and learn from others.</p>
            </div>
            <div className="text-left">
              <h4 className="text-xl font-semibold mb-3">🎉 Enjoy & Have Fun</h4>
              <p className="text-muted-foreground">Build genuine relationships and friendships in a fun, welcoming environment.</p>
            </div>
            <div className="text-left">
              <h4 className="text-xl font-semibold mb-3">💭 Get Public Opinion</h4>
              <p className="text-muted-foreground">Discuss topics you might feel shy about sharing with friends.</p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center bg-gradient-to-r from-primary/10 to-secondary/10 rounded-2xl p-12">
          <h3 className="text-3xl font-bold mb-4">Ready to Start Chatting?</h3>
          <p className="text-xl text-muted-foreground mb-8">Join thousands of people already having amazing conversations</p>
          <Link to="/chat">
            <Button size="lg" className="text-lg px-12 py-6 gap-3">
              <MessageCircle className="w-6 h-6" />
              Enter Chat Rooms Now
            </Button>
          </Link>
        </div>
      </div>

      {/* Footer with more ad spaces */}
      <footer className="border-t bg-card/50 mt-16">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card className="p-4 bg-gradient-to-br from-cyan-100 to-cyan-200 dark:from-cyan-900/20 dark:to-cyan-800/20">
              <CardContent className="p-0 text-center">
                <h4 className="font-semibold text-cyan-800 dark:text-cyan-200 mb-2">Footer Ad</h4>
                <div className="p-4 bg-white/50 dark:bg-black/20 rounded">
                  <p className="text-xs text-cyan-700 dark:text-cyan-300">250x150</p>
                </div>
              </CardContent>
            </Card>
            <Card className="p-4 bg-gradient-to-br from-violet-100 to-violet-200 dark:from-violet-900/20 dark:to-violet-800/20">
              <CardContent className="p-0 text-center">
                <h4 className="font-semibold text-violet-800 dark:text-violet-200 mb-2">Sponsor</h4>
                <div className="p-4 bg-white/50 dark:bg-black/20 rounded">
                  <p className="text-xs text-violet-700 dark:text-violet-300">250x150</p>
                </div>
              </CardContent>
            </Card>
            <Card className="p-4 bg-gradient-to-br from-emerald-100 to-emerald-200 dark:from-emerald-900/20 dark:to-emerald-800/20">
              <CardContent className="p-0 text-center">
                <h4 className="font-semibold text-emerald-800 dark:text-emerald-200 mb-2">Partner</h4>
                <div className="p-4 bg-white/50 dark:bg-black/20 rounded">
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">250x150</p>
                </div>
              </CardContent>
            </Card>
            <Card className="p-4 bg-gradient-to-br from-rose-100 to-rose-200 dark:from-rose-900/20 dark:to-rose-800/20">
              <CardContent className="p-0 text-center">
                <h4 className="font-semibold text-rose-800 dark:text-rose-200 mb-2">Featured</h4>
                <div className="p-4 bg-white/50 dark:bg-black/20 rounded">
                  <p className="text-xs text-rose-700 dark:text-rose-300">250x150</p>
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="text-center text-muted-foreground">
            <p>&copy; 2024 StrangerChat. Connecting people worldwide through conversation.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
