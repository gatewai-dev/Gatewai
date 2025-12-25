import { useCanvasListCtx } from "../ctx/canvas-list.ctx";
import { LayoutGrid, List, Network, Clock, Calendar, FileText, Sparkles } from 'lucide-react';

// Helper function to format time distance
const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    const intervals = {
        year: 31536000,
        month: 2592000,
        week: 604800,
        day: 86400,
        hour: 3600,
        minute: 60
    };

    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
        const interval = Math.floor(seconds / secondsInUnit);
        if (interval >= 1) {
            return `${interval} ${unit}${interval === 1 ? '' : 's'} ago`;
        }
    }
    return 'just now';
};
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router";

function CanvasHome() {
    const { canvasList, isLoading, isError, searchQuery, setSearchQuery, createCanvas, isCreating } = useCanvasListCtx();
    const nav = useNavigate();
    const [view, setView] = useState<'grid' | 'list'>('grid');

    const handleCreateCanvas = async () => {
        try {
            const result = await createCanvas('untitled').unwrap();
            nav(`/canvas/${result.id}`);
        } catch (error) {
            console.error('Failed to create canvas:', error);
        }
    };

    if (isError) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-red-500">
                <div className="text-center space-y-2">
                    <p className="text-lg font-semibold">Something went wrong</p>
                    <p className="text-sm text-muted-foreground">Unable to load your canvases. Please try again later.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-linear-to-br from-background via-background to-muted/20">
            <div className="max-w-7xl mx-auto p-8 space-y-8">
                {/* Header Section */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="space-y-1">
                        <h1 className="text-3xl font-bold tracking-tight">Your Workspace</h1>
                        <p className="text-muted-foreground">Manage and organize your creative canvases</p>
                    </div>
                    <Button 
                        onClick={handleCreateCanvas}
                        disabled={isCreating}
                        size="lg"
                        className="bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl transition-all"
                    >
                        <Sparkles className="h-4 w-4 mr-2" />
                        New Canvas
                    </Button>
                </div>

                {/* Search and View Controls */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card/50 backdrop-blur-sm rounded-xl p-4 border">
                    <h2 className="text-lg font-semibold">All Canvases ({canvasList?.length || 0})</h2>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <Input
                            placeholder="Search canvases..."
                            value={searchQuery || ''}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full sm:w-64 bg-background/50"
                        />
                        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setView('grid')}
                                className={view === 'grid' ? 'bg-background shadow-sm' : ''}
                            >
                                <LayoutGrid className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setView('list')}
                                className={view === 'list' ? 'bg-background shadow-sm' : ''}
                            >
                                <List className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>

                {isLoading ? (
                    view === 'grid' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {[...Array(8)].map((_, i) => (
                                <Skeleton key={i} className="h-48 rounded-xl" />
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {[...Array(6)].map((_, i) => (
                                <Skeleton key={i} className="h-24 rounded-xl" />
                            ))}
                        </div>
                    )
                ) : canvasList && canvasList.length > 0 ? (
                    <>
                        {view === 'grid' ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {canvasList.map((canvas) => (
                                    <Card
                                        key={canvas.id}
                                        onClick={() => nav(`/canvas/${canvas.id}`)}
                                        className="group hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 cursor-pointer border-2 hover:border-primary/50 bg-linear-to-br from-card to-card/50 overflow-hidden"
                                    >
                                        <CardHeader className="space-y-3">
                                            <div className="flex justify-between items-start">
                                                <div className="p-3 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                                                    <Network className="h-6 w-6 text-primary" />
                                                </div>
                                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                    <FileText className="h-3 w-3" />
                                                    <span>0</span>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <CardTitle className="text-lg font-bold truncate group-hover:text-primary transition-colors">
                                                    {canvas.name}
                                                </CardTitle>
                                                <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                                                    <div className="flex items-center gap-1.5">
                                                        <Clock className="h-3 w-3" />
                                                        <span>Edited {formatTimeAgo(new Date(canvas.updatedAt))}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <Calendar className="h-3 w-3" />
                                                        <span>Created {formatTimeAgo(new Date(canvas.createdAt))}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </CardHeader>
                                    </Card>
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {canvasList.map((canvas) => (
                                    <Card
                                        key={canvas.id}
                                        onClick={() => nav(`/canvas/${canvas.id}`)}
                                        className="group hover:shadow-lg hover:border-primary/50 transition-all duration-200 cursor-pointer bg-linear-to-r from-card to-card/50"
                                    >
                                        <CardContent className="p-6">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                                    <div className="p-3 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors shrink-0">
                                                        <Network className="h-5 w-5 text-primary" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h3 className="font-bold text-lg truncate group-hover:text-primary transition-colors">
                                                            {canvas.name}
                                                        </h3>
                                                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                                                            <div className="flex items-center gap-1.5">
                                                                <Clock className="h-3.5 w-3.5" />
                                                                <span>{formatTimeAgo(new Date(canvas.updatedAt))}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5">
                                                                <Calendar className="h-3.5 w-3.5" />
                                                                <span>{formatTimeAgo(new Date(canvas.createdAt))}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
                                                    <FileText className="h-4 w-4" />
                                                    <span>0 files</span>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-96 text-center">
                        <div className="p-6 bg-muted/30 rounded-full mb-6">
                            <Network className="h-16 w-16 text-muted-foreground" />
                        </div>
                        <h3 className="text-xl font-semibold mb-2">No canvases yet</h3>
                        <p className="text-muted-foreground mb-6 max-w-md">
                            Get started by creating your first canvas and bring your ideas to life
                        </p>
                        <Button 
                            onClick={handleCreateCanvas}
                            disabled={isCreating}
                            size="lg"
                        >
                            <Sparkles className="h-4 w-4 mr-2" />
                            Create Your First Canvas
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}

export { CanvasHome };