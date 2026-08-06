import { Building2, LayoutDashboard, Search, Zap, CheckCircle2, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

export function LandingPage({
  onGetStarted,
  onLogin
}: {
  onGetStarted: () => void;
  onLogin: () => void;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col relative overflow-hidden">
      {/* Background Ambience */}
      <div 
        className="fixed inset-0 pointer-events-none" 
        style={{
          background: "radial-gradient(ellipse 800px 500px at 50% 20%, oklch(0.20 0.005 285 / 0.4) 0%, transparent 70%)",
        }} 
      />
      <div 
        className="fixed inset-0 pointer-events-none" 
        style={{
          background: "radial-gradient(ellipse 600px 400px at 80% 80%, oklch(0.15 0.005 285 / 0.3) 0%, transparent 70%)",
        }} 
      />

      {/* Navbar */}
      <nav className="relative z-10 w-full max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-[12px] flex items-center justify-center"
            style={{ background: "oklch(0.98 0 0)", boxShadow: "0 4px 15px oklch(0 0 0 / 0.4)" }}
          >
            <Building2 size={20} style={{ color: "oklch(0.12 0.005 285)" }} />
          </div>
          <span className="text-xl font-bold tracking-tight text-foreground">RoverBuddiesKoi</span>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="ghost" className="text-muted-foreground hover:text-foreground" onClick={onLogin}>
            Sign In
          </Button>
          <Button className="gap-2" onClick={onGetStarted}>
            Get Started <ArrowRight size={14} />
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center mt-12 pb-24">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-secondary/50 backdrop-blur-sm mb-8">
          <span className="flex h-2 w-2 rounded-full bg-success"></span>
          <span className="text-xs font-medium text-muted-foreground">CAIR Lab · Fall 2026</span>
        </div>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-foreground max-w-4xl leading-[1.1]">
          Know who's <span className="text-transparent bg-clip-text bg-gradient-to-r from-foreground to-muted-foreground">available</span> <br className="hidden md:block"/> before asking.
        </h1>
        
        <p className="text-lg md:text-xl text-muted-foreground mt-6 max-w-2xl font-light">
          An AI-powered availability management platform designed for organizations with multiple teams and subteams. 
          Stop guessing and start building.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 mt-10">
          <Button size="lg" className="h-14 px-8 text-base gap-2 rounded-xl" onClick={onGetStarted}>
            Get Started <ArrowRight size={16} />
          </Button>
          <Button size="lg" variant="outline" className="h-14 px-8 text-base rounded-xl" onClick={onLogin}>
            Sign In to Account
          </Button>
        </div>

        {/* Features / Roles Grid */}
        <div className="mt-28 w-full max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <RoleFeatureCard 
            title="Organization Owner" 
            desc="Full org access — manage teams, roles & semesters." 
            icon={<Building2 size={18} />}
            accent="oklch(0.60 0.20 15)" 
            scope="All teams"
          />
          <RoleFeatureCard 
            title="Team Manager" 
            desc="Manage your assigned team and its subteams." 
            icon={<LayoutDashboard size={18} />}
            accent="oklch(0.75 0.15 80)"
            scope="Team-scoped"
          />
          <RoleFeatureCard 
            title="Subteam Manager" 
            desc="Manage members and skills within your subteam." 
            icon={<Search size={18} />}
            accent="oklch(0.65 0.15 150)" 
            scope="Subteam-scoped"
          />
          <RoleFeatureCard 
            title="Member" 
            desc="Upload routine, request skills & find teammates." 
            icon={<Zap size={18} />}
            accent="oklch(0.65 0 0)" 
            scope="Own subteam"
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border py-8 text-center text-sm text-muted-foreground font-mono">
        CAIR Lab · Robotics Division · RoverBuddiesKoi
      </footer>
    </div>
  )
}

function RoleFeatureCard({ title, desc, icon, accent, scope }: { title: string, desc: string, icon: React.ReactNode, accent: string, scope: string }) {
  return (
    <div 
      className="group relative flex flex-col items-start p-6 rounded-2xl border bg-card/40 backdrop-blur-sm text-left transition-all duration-300 hover:bg-card/80 hover:-translate-y-1"
      style={{ borderColor: "var(--border)" }}
    >
      <div 
        className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110"
        style={{ background: `color-mix(in oklch, ${accent} 20%, transparent)`, color: accent }}
      >
        {icon}
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground mt-2 leading-relaxed flex-1">{desc}</p>
      
      <div className="mt-6 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary/50 border border-border/50 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
        <CheckCircle2 size={12} style={{ color: accent }} />
        {scope}
      </div>
      
      {/* Accent glow on hover */}
      <div 
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-300"
        style={{ boxShadow: `inset 0 0 0 1px ${accent}40` }}
      />
    </div>
  )
}
