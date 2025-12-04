'use client';

/**
 * AI Generation Page
 */

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import {
  Sparkles,
  Wand2,
  FileText,
  Image,
  Tag,
  TrendingUp,
  Zap,
  Clock,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  Play,
  Settings,
} from 'lucide-react';

// AI Tool Card Component
function AIToolCard({
  title,
  description,
  icon: Icon,
  iconBg,
  status,
  onClick,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  status?: 'available' | 'coming_soon';
  onClick?: () => void;
}) {
  const isAvailable = status !== 'coming_soon';

  return (
    <button
      onClick={isAvailable ? onClick : undefined}
      disabled={!isAvailable}
      className={`w-full text-left p-5 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl transition-all duration-200 ${
        isAvailable
          ? 'hover:border-[var(--primary)] hover:shadow-lg hover:shadow-[var(--primary)]/10 cursor-pointer'
          : 'opacity-60 cursor-not-allowed'
      }`}
    >
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-[var(--text-primary)] font-semibold">{title}</h3>
            {status === 'coming_soon' && (
              <span className="px-2 py-0.5 bg-[var(--warning-bg)] text-[var(--warning)] text-xs font-medium rounded-full">
                Coming Soon
              </span>
            )}
          </div>
          <p className="text-[var(--text-muted)] text-sm">{description}</p>
        </div>
        {isAvailable && (
          <ChevronRight className="w-5 h-5 text-[var(--text-muted)]" />
        )}
      </div>
    </button>
  );
}

// Recent Generation Item
function RecentGeneration({
  type,
  title,
  timestamp,
  status,
}: {
  type: 'title' | 'description' | 'tags';
  title: string;
  timestamp: string;
  status: 'completed' | 'failed';
}) {
  const typeIcons = {
    title: FileText,
    description: Wand2,
    tags: Tag,
  };
  const Icon = typeIcons[type];

  return (
    <div className="flex items-center justify-between py-3 border-b border-[var(--border-color)] last:border-0">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-[var(--background)] flex items-center justify-center">
          <Icon className="w-5 h-5 text-[var(--text-muted)]" />
        </div>
        <div>
          <p className="text-[var(--text-primary)] font-medium">{title}</p>
          <p className="text-[var(--text-muted)] text-sm">{timestamp}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {status === 'completed' ? (
          <span className="flex items-center gap-1 text-[var(--success)] text-sm">
            <CheckCircle className="w-4 h-4" />
            Completed
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[var(--danger)] text-sm">
            <AlertCircle className="w-4 h-4" />
            Failed
          </span>
        )}
      </div>
    </div>
  );
}

export default function AIGenerationPage() {
  const [selectedTool, setSelectedTool] = useState<string | null>(null);

  return (
    <DashboardLayout>
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-3">
              <Sparkles className="w-7 h-7 text-[var(--primary)]" />
              AI Generation
            </h1>
            <p className="text-[var(--text-muted)] mt-1">
              Generate product titles, descriptions, and tags using AI
            </p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--card-bg-hover)] transition-colors">
            <Settings className="w-4 h-4" />
            AI Settings
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--primary-bg)] flex items-center justify-center">
                <Zap className="w-5 h-5 text-[var(--primary)]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--text-primary)]">1,247</p>
                <p className="text-[var(--text-muted)] text-sm">Total Generations</p>
              </div>
            </div>
          </div>
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--success-bg)] flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-[var(--success)]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--text-primary)]">98.5%</p>
                <p className="text-[var(--text-muted)] text-sm">Success Rate</p>
              </div>
            </div>
          </div>
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--info-bg)] flex items-center justify-center">
                <Clock className="w-5 h-5 text-[var(--info)]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--text-primary)]">2.3s</p>
                <p className="text-[var(--text-muted)] text-sm">Avg. Response Time</p>
              </div>
            </div>
          </div>
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--warning-bg)] flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-[var(--warning)]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--text-primary)]">+23%</p>
                <p className="text-[var(--text-muted)] text-sm">This Month</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* AI Tools */}
          <div className="lg:col-span-2 space-y-6">
            <DashboardCard title="AI Tools" subtitle="Select a tool to get started">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AIToolCard
                  title="Title Generator"
                  description="Generate SEO-optimized product titles"
                  icon={FileText}
                  iconBg="gradient-primary"
                  status="available"
                  onClick={() => setSelectedTool('title')}
                />
                <AIToolCard
                  title="Description Writer"
                  description="Create compelling product descriptions"
                  icon={Wand2}
                  iconBg="gradient-info"
                  status="available"
                  onClick={() => setSelectedTool('description')}
                />
                <AIToolCard
                  title="Tag Optimizer"
                  description="Generate relevant tags for better visibility"
                  icon={Tag}
                  iconBg="gradient-success"
                  status="available"
                  onClick={() => setSelectedTool('tags')}
                />
                <AIToolCard
                  title="Image Enhancer"
                  description="AI-powered image optimization"
                  icon={Image}
                  iconBg="gradient-warning"
                  status="coming_soon"
                />
              </div>
            </DashboardCard>

            {/* Quick Generate */}
            <DashboardCard title="Quick Generate" subtitle="Generate content for a product">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                    Product Name or URL
                  </label>
                  <input
                    type="text"
                    placeholder="Enter product name or paste Etsy URL..."
                    className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                    What to Generate
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {['Title', 'Description', 'Tags', 'All'].map((option) => (
                      <button
                        key={option}
                        className="px-4 py-2 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--text-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
                <button className="w-full py-3 gradient-primary text-white font-semibold rounded-lg hover:opacity-90 transition flex items-center justify-center gap-2 shadow-lg shadow-[var(--primary)]/25">
                  <Play className="w-5 h-5" />
                  Generate Now
                </button>
              </div>
            </DashboardCard>
          </div>

          {/* Recent Generations */}
          <div className="space-y-6">
            <DashboardCard
              title="Recent Generations"
              subtitle="Your latest AI generations"
              action={
                <a href="/ai/history" className="text-sm text-[var(--primary)] hover:underline">
                  View All
                </a>
              }
            >
              <RecentGeneration
                type="title"
                title="Handmade Silver Ring - Bohemian Style"
                timestamp="2 minutes ago"
                status="completed"
              />
              <RecentGeneration
                type="description"
                title="Vintage Leather Wallet Description"
                timestamp="15 minutes ago"
                status="completed"
              />
              <RecentGeneration
                type="tags"
                title="Ceramic Plant Pot Tags"
                timestamp="1 hour ago"
                status="completed"
              />
              <RecentGeneration
                type="title"
                title="Custom Photo Frame Title"
                timestamp="2 hours ago"
                status="failed"
              />
            </DashboardCard>

            {/* Tips Card */}
            <div className="bg-gradient-to-br from-[var(--primary-bg)] to-[var(--info-bg)] border border-[var(--primary)]/30 rounded-xl p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--primary)] flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="text-[var(--text-primary)] font-semibold mb-2">Pro Tips</h4>
                  <ul className="text-[var(--text-muted)] text-sm space-y-1">
                    <li>• Be specific with your product details</li>
                    <li>• Include target keywords for better SEO</li>
                    <li>• Review and customize generated content</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
