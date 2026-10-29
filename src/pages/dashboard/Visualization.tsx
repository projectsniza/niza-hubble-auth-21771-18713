import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useOrgBranch } from '@/contexts/OrgBranchContext';
import { useDigitalTwinData } from '@/components/visualization/useDigitalTwinData';
import { DigitalTwinCanvas } from '@/components/visualization/DigitalTwinCanvas';
import { GamifiedDock } from '@/components/visualization/GamifiedDock';
import { DataHUDPanel } from '@/components/visualization/DataHUDPanel';
import { Fallback2DGrid } from '@/components/visualization/Fallback2DGrid';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Maximize2,
  Minimize2,
  RefreshCw,
  Building2,
  ArrowLeft,
  Plus,
  Minus,
  Compass,
} from 'lucide-react';

function checkWebGLSupport(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

export default function Visualization() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { branches } = useOrgBranch();

  // Selected branch: super_admin can view all branches or filter by branch
  const [selectedBranchId, setSelectedBranchId] = useState<string | 'all'>('all');
  const [focusedZone, setFocusedZone] = useState<string | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [viewMode, setViewMode] = useState<'3d' | '2d'>('3d');
  const [hasWebGL, setHasWebGL] = useState<boolean>(true);

  // Check WebGL availability on mount
  useEffect(() => {
    const supported = checkWebGLSupport();
    setHasWebGL(supported);
    if (!supported) {
      setViewMode('2d');
    }
  }, []);

  // Sync digital twin live telemetry
  const { metrics, loading, pulseTriggeredZones, refetch } =
    useDigitalTwinData(selectedBranchId);

  // Handle ESC key to reset camera to overview
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFocusedZone(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Toggle true fullscreen
  const toggleFullScreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullScreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullScreen(false);
    }
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  // Filter branches visible to current user
  const userBranches = useMemo(() => {
    if (user?.role === 'super_admin') return branches;
    if (user?.branchIds && user.branchIds.length > 0) {
      return branches.filter((b) => user.branchIds?.includes(b.id));
    }
    return branches;
  }, [branches, user]);

  const handleZoom = (delta: number) => {
    const canvasEl = document.querySelector('canvas');
    if (canvasEl) {
      canvasEl.dispatchEvent(new WheelEvent('wheel', { deltaY: delta, bubbles: true }));
    }
  };

  return (
    <div
      className={`relative w-full bg-slate-950 text-slate-100 flex flex-col overflow-hidden select-none ${
        isFullScreen ? 'fixed inset-0 z-50 h-screen' : 'h-[calc(100vh-3.5rem)]'
      }`}
    >
      {/* Top Floating Control Bar */}
      <header className="absolute top-4 left-4 right-4 z-30 flex items-center justify-between gap-3 pointer-events-none">
        {/* Left Side: Back & Branch Selector */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/dashboard')}
            className="h-9 px-3 rounded-xl border border-primary/30 bg-slate-900/90 hover:bg-slate-800 text-slate-200 backdrop-blur-md shadow-lg gap-1.5"
            title="Back to Dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline text-xs font-medium">Dashboard</span>
          </Button>

          {/* Branch Switcher for Super Admin and Multi-branch Managers */}
          {userBranches.length > 0 && (
            <div className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md border border-primary/30 rounded-xl px-2.5 py-1 shadow-lg">
              <Building2 className="h-4 w-4 text-primary" />
              <Select
                value={selectedBranchId}
                onValueChange={(val) => setSelectedBranchId(val)}
              >
                <SelectTrigger className="h-7 border-0 bg-transparent text-xs font-medium focus:ring-0 text-slate-200 px-1 gap-1">
                  <SelectValue placeholder="Select Branch" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-primary/40 text-slate-200 shadow-xl">
                  <SelectItem value="all">All Branches (Overview)</SelectItem>
                  {userBranches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Right Side: Refresh & Fullscreen */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Refresh Data */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refetch()}
            className="h-9 w-9 rounded-xl border border-primary/30 bg-slate-900/90 hover:bg-slate-800 text-slate-300 backdrop-blur-md shadow-lg"
            title="Refresh Live Data"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-primary' : ''}`} />
          </Button>

          {/* Fullscreen Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleFullScreen}
            className="h-9 w-9 rounded-xl border border-primary/30 bg-slate-900/90 hover:bg-slate-800 text-slate-300 backdrop-blur-md shadow-lg"
            title={isFullScreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullScreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </header>

      {/* Main View Area */}
      <div className="flex-1 w-full h-full relative overflow-hidden">
        {viewMode === '3d' && hasWebGL ? (
          <>
            <DigitalTwinCanvas
              focusedZone={focusedZone}
              onSelectZone={(zoneId) => setFocusedZone(zoneId)}
              metrics={metrics}
              pulseTriggeredZones={pulseTriggeredZones}
            />

            {/* Floating Zoom & Overview Controls (Bottom Right) */}
            <div className="absolute bottom-6 right-6 z-40 flex flex-col gap-1.5 pointer-events-auto">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleZoom(-250)}
                className="h-9 w-9 rounded-xl border border-primary/30 bg-slate-900/90 hover:bg-slate-800 text-slate-200 backdrop-blur-md shadow-xl hover:scale-105 active:scale-95 transition-all"
                title="Zoom In (or scroll up)"
                aria-label="Zoom in"
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleZoom(250)}
                className="h-9 w-9 rounded-xl border border-primary/30 bg-slate-900/90 hover:bg-slate-800 text-slate-200 backdrop-blur-md shadow-xl hover:scale-105 active:scale-95 transition-all"
                title="Zoom Out (or scroll down)"
                aria-label="Zoom out"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setFocusedZone(null)}
                className="h-9 w-9 rounded-xl border border-primary/30 bg-slate-900/90 hover:bg-slate-800 text-slate-200 backdrop-blur-md shadow-xl hover:scale-105 active:scale-95 transition-all"
                title="Reset Camera to Site Overview (Esc)"
                aria-label="Reset camera view"
              >
                <Compass className="h-4 w-4 text-primary" />
              </Button>
            </div>
          </>
        ) : (
          <div className="w-full h-full overflow-y-auto pt-24 pb-28">
            <Fallback2DGrid
              metrics={metrics}
              onSelectModule={(modId) => setFocusedZone(modId)}
            />
          </div>
        )}

        {/* Gamified Pill Dock - Floating at bottom center, guaranteed visible */}
        <GamifiedDock
          activeZone={focusedZone}
          onSelectZone={(zoneId) => setFocusedZone(zoneId)}
          metrics={metrics}
          pulseTriggeredZones={pulseTriggeredZones}
        />

        {/* 2D HUD Telemetry Panel on Focus */}
        {focusedZone && (
          <DataHUDPanel
            focusedZone={focusedZone}
            onClose={() => setFocusedZone(null)}
            metrics={metrics}
          />
        )}
      </div>
    </div>
  );
}
