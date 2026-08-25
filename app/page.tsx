"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Check, FileText, Shield, Zap, Upload, BarChart3, Download, Menu, X } from "lucide-react";
import { useState } from "react";

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-[#0a0a0f] text-white overflow-x-hidden">
      {/* Navigation */}
      <header className="px-4 lg:px-6 h-16 flex items-center justify-between border-b border-white/5 bg-[#0a0a0f]/80 backdrop-blur-xl sticky top-0 z-50">
        <Link className="flex items-center justify-center gap-2" href="/">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
            <FileText className="h-4 w-4 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight">Ozio</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex gap-6 items-center">
          <Link className="text-sm text-white/60 hover:text-white transition-colors" href="#how-it-works">
            How it Works
          </Link>
          <Link className="text-sm text-white/60 hover:text-white transition-colors" href="#features">
            Features
          </Link>
          <Link className="text-sm text-white/60 hover:text-white transition-colors" href="#pricing">
            Pricing
          </Link>
          <div className="flex items-center gap-3 ml-4">
            <Button variant="ghost" className="text-white/80 hover:text-white hover:bg-white/10" asChild>
              <Link href="/login">Log in</Link>
            </Button>
            <Button className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 border-0 shadow-lg shadow-blue-500/25" asChild>
              <Link href="/signup">Start Free <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </div>
        </nav>

        {/* Mobile Menu Toggle */}
        <button className="md:hidden text-white/80" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </header>

      {/* Mobile Nav Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#0a0a0f] border-b border-white/5 px-4 py-4 flex flex-col gap-3 sticky top-16 z-40">
          <Link className="text-sm text-white/60 py-2" href="#how-it-works" onClick={() => setMobileMenuOpen(false)}>How it Works</Link>
          <Link className="text-sm text-white/60 py-2" href="#features" onClick={() => setMobileMenuOpen(false)}>Features</Link>
          <Link className="text-sm text-white/60 py-2" href="#pricing" onClick={() => setMobileMenuOpen(false)}>Pricing</Link>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1 border-white/20 text-white bg-transparent" asChild>
              <Link href="/login">Log in</Link>
            </Button>
            <Button className="flex-1 bg-gradient-to-r from-blue-600 to-violet-600 border-0" asChild>
              <Link href="/signup">Start Free</Link>
            </Button>
          </div>
        </div>
      )}

      <main className="flex-1">
        {/* Hero Section */}
        <section className="w-full pt-24 pb-32 md:pt-32 md:pb-40 flex justify-center items-center relative">
          {/* Background effects */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] bg-gradient-to-b from-blue-600/15 via-violet-600/10 to-transparent rounded-full blur-3xl -z-10" />
          <div className="absolute top-20 right-1/4 w-[300px] h-[300px] bg-blue-500/10 rounded-full blur-3xl -z-10 animate-pulse" />
          <div className="absolute top-40 left-1/4 w-[200px] h-[200px] bg-violet-500/10 rounded-full blur-3xl -z-10 animate-pulse" style={{ animationDelay: "1s" }} />

          <div className="container px-4 md:px-6 flex flex-col items-center text-center space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-sm text-white/70">
              <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
              Powered by GPT-4o Vision
            </div>

            <div className="space-y-6 max-w-[900px]">
              <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl leading-[1.1]">
                Invoices in.{" "}
                <span className="bg-gradient-to-r from-blue-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">
                  Data out.
                </span>
                <br />
                Zero manual entry.
              </h1>
              <p className="mx-auto max-w-[600px] text-white/50 md:text-xl leading-relaxed">
                Drop any invoice — photo, scan, or PDF. AI extracts every field in seconds. Track expenses, generate reports, and never touch a spreadsheet again.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" className="h-13 px-8 text-base bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 border-0 shadow-lg shadow-blue-500/25 rounded-xl" asChild>
                <Link href="/signup">
                  Start for free <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="h-13 px-8 text-base border-white/10 bg-white/5 hover:bg-white/10 text-white rounded-xl">
                See it in action
              </Button>
            </div>

            {/* Stats bar */}
            <div className="flex flex-wrap justify-center gap-8 md:gap-16 pt-8 border-t border-white/5 mt-8 w-full max-w-xl">
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-bold">99.2%</div>
                <div className="text-sm text-white/40">Extraction Accuracy</div>
              </div>
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-bold">&lt;3s</div>
                <div className="text-sm text-white/40">Processing Time</div>
              </div>
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-bold">85%</div>
                <div className="text-sm text-white/40">Time Saved</div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="w-full py-24 flex justify-center border-t border-white/5">
          <div className="container px-4 md:px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl mb-4">Three steps. That&apos;s it.</h2>
              <p className="text-white/50 max-w-[500px] mx-auto">No setup wizards. No configuration hell. Upload and go.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              {[
                { step: "01", icon: Upload, title: "Upload", desc: "Drag and drop invoices — JPG, PNG, PDF. Bulk upload supported." },
                { step: "02", icon: Zap, title: "AI Extracts", desc: "GPT-4o Vision reads every field: vendor, date, line items, tax, total." },
                { step: "03", icon: BarChart3, title: "Track & Export", desc: "View expenses, filter by category, download CSV or PDF reports." },
              ].map((item) => (
                <div key={item.step} className="relative p-6 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-all group">
                  <span className="text-5xl font-black text-white/[0.04] absolute top-4 right-4 group-hover:text-white/[0.08] transition-colors">{item.step}</span>
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 flex items-center justify-center mb-4">
                    <item.icon className="h-6 w-6 text-blue-400" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                  <p className="text-sm text-white/40 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="w-full py-24 flex justify-center border-t border-white/5 bg-gradient-to-b from-transparent via-blue-950/10 to-transparent">
          <div className="container px-4 md:px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl mb-4">Built for real businesses</h2>
              <p className="text-white/50 max-w-[600px] mx-auto">Not a toy demo. Production-grade features with enterprise security.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { icon: Zap, title: "GPT-4o Vision OCR", desc: "Handles tables, handwriting, and multi-page documents", color: "from-amber-500/20 to-orange-500/20", iconColor: "text-amber-400" },
                { icon: Shield, title: "Row Level Security", desc: "PostgreSQL RLS policies — your data is invisible to others", color: "from-green-500/20 to-emerald-500/20", iconColor: "text-green-400" },
                { icon: FileText, title: "Smart Categories", desc: "AI auto-tags expenses based on vendor and description", color: "from-blue-500/20 to-cyan-500/20", iconColor: "text-blue-400" },
                { icon: Download, title: "CSV & PDF Export", desc: "One-click export for your accountant or tax filing", color: "from-violet-500/20 to-purple-500/20", iconColor: "text-violet-400" },
                { icon: BarChart3, title: "Live Analytics", desc: "Monthly trends, category breakdowns, vendor rankings", color: "from-pink-500/20 to-rose-500/20", iconColor: "text-pink-400" },
                { icon: Upload, title: "Bulk Upload", desc: "Drop 50 invoices at once. We process them all in parallel", color: "from-teal-500/20 to-cyan-500/20", iconColor: "text-teal-400" },
              ].map((feature) => (
                <div key={feature.title} className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 hover:bg-white/[0.04] transition-all">
                  <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${feature.color} flex items-center justify-center mb-3`}>
                    <feature.icon className={`h-5 w-5 ${feature.iconColor}`} />
                  </div>
                  <h3 className="font-semibold mb-1">{feature.title}</h3>
                  <p className="text-sm text-white/40">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="w-full py-24 flex justify-center border-t border-white/5">
          <div className="container px-4 md:px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl mb-4">Simple pricing</h2>
              <p className="text-white/50 max-w-[500px] mx-auto">Start free. Scale when you&apos;re ready.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">

              <Card className="flex flex-col bg-white/[0.03] border-white/5 text-white">
                <CardHeader>
                  <CardTitle className="text-xl text-white/80">Starter</CardTitle>
                  <p className="text-sm text-white/40">For freelancers & solo founders</p>
                  <div className="mt-4 flex items-baseline">
                    <span className="text-4xl font-bold">₹0</span>
                    <span className="ml-1 text-white/40">/mo</span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1">
                  <ul className="space-y-3 text-sm">
                    <li className="flex items-center gap-2 text-white/60"><Check className="h-4 w-4 text-green-400 shrink-0" /> 20 AI extractions / month</li>
                    <li className="flex items-center gap-2 text-white/60"><Check className="h-4 w-4 text-green-400 shrink-0" /> Basic reporting</li>
                    <li className="flex items-center gap-2 text-white/60"><Check className="h-4 w-4 text-green-400 shrink-0" /> Email support</li>
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button className="w-full bg-white/5 hover:bg-white/10 text-white border border-white/10" asChild>
                    <Link href="/signup">Get Started</Link>
                  </Button>
                </CardFooter>
              </Card>

              <Card className="flex flex-col bg-gradient-to-b from-blue-600/10 to-violet-600/10 border-blue-500/30 text-white relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-violet-600 text-white px-4 py-1 text-xs font-semibold rounded-full">
                  MOST POPULAR
                </div>
                <CardHeader>
                  <CardTitle className="text-xl text-blue-400">Pro</CardTitle>
                  <p className="text-sm text-white/40">For growing teams</p>
                  <div className="mt-4 flex items-baseline">
                    <span className="text-4xl font-bold">₹2,499</span>
                    <span className="ml-1 text-white/40">/mo</span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1">
                  <ul className="space-y-3 text-sm">
                    <li className="flex items-center gap-2 text-white/60"><Check className="h-4 w-4 text-blue-400 shrink-0" /> 500 AI extractions / month</li>
                    <li className="flex items-center gap-2 text-white/60"><Check className="h-4 w-4 text-blue-400 shrink-0" /> Advanced analytics</li>
                    <li className="flex items-center gap-2 text-white/60"><Check className="h-4 w-4 text-blue-400 shrink-0" /> CSV & PDF exports</li>
                    <li className="flex items-center gap-2 text-white/60"><Check className="h-4 w-4 text-blue-400 shrink-0" /> Priority support</li>
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button className="w-full bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white border-0 shadow-lg shadow-blue-500/20" asChild>
                    <Link href="/signup">Start Free Trial</Link>
                  </Button>
                </CardFooter>
              </Card>

              <Card className="flex flex-col bg-white/[0.03] border-white/5 text-white">
                <CardHeader>
                  <CardTitle className="text-xl text-white/80">Enterprise</CardTitle>
                  <p className="text-sm text-white/40">For large operations</p>
                  <div className="mt-4 flex items-baseline">
                    <span className="text-4xl font-bold">₹7,999</span>
                    <span className="ml-1 text-white/40">/mo</span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1">
                  <ul className="space-y-3 text-sm">
                    <li className="flex items-center gap-2 text-white/60"><Check className="h-4 w-4 text-green-400 shrink-0" /> Unlimited extractions</li>
                    <li className="flex items-center gap-2 text-white/60"><Check className="h-4 w-4 text-green-400 shrink-0" /> Custom integrations</li>
                    <li className="flex items-center gap-2 text-white/60"><Check className="h-4 w-4 text-green-400 shrink-0" /> Dedicated account manager</li>
                    <li className="flex items-center gap-2 text-white/60"><Check className="h-4 w-4 text-green-400 shrink-0" /> SSO & audit logs</li>
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button className="w-full bg-white/5 hover:bg-white/10 text-white border border-white/10">
                    Contact Sales
                  </Button>
                </CardFooter>
              </Card>

            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="w-full py-24 flex justify-center border-t border-white/5 relative">
          <div className="absolute inset-0 bg-gradient-to-t from-blue-600/5 via-transparent to-transparent -z-10" />
          <div className="container px-4 md:px-6 text-center">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl mb-4">Ready to stop typing invoices?</h2>
            <p className="text-white/50 max-w-[500px] mx-auto mb-8">Join thousands of businesses automating their expense workflow.</p>
            <Button size="lg" className="h-13 px-10 text-base bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 border-0 shadow-lg shadow-blue-500/25 rounded-xl" asChild>
              <Link href="/signup">Get started — it&apos;s free <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full py-8 border-t border-white/5 flex items-center justify-center">
        <div className="container px-4 md:px-6 flex flex-col md:flex-row justify-between items-center text-sm text-white/30">
          <p>© {new Date().getFullYear()} Ozio. All rights reserved.</p>
          <div className="flex gap-6 mt-4 md:mt-0">
            <Link className="hover:text-white/60 transition-colors" href="#">Terms</Link>
            <Link className="hover:text-white/60 transition-colors" href="#">Privacy</Link>
            <Link className="hover:text-white/60 transition-colors" href="#">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}