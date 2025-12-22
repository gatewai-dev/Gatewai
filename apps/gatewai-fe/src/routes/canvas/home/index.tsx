import { useCanvasListCtx } from "../ctx/canvas-list.ctx";
import { formatDistanceToNow } from 'date-fns';
import { LayoutGrid, List, Network } from 'lucide-react';
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCanvasCreationCtx } from "../ctx/canvas-new.ctx";

function CanvasHome() {
    const { canvasList, isLoading, isError, searchQuery, setSearchQuery } = useCanvasListCtx();
    const { createCanvas, isCreating } = useCanvasCreationCtx();
    const [view, setView] = useState<'grid' | 'list'>('list');

    if (isError) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-red-500">
                Error loading canvases. Please try again later.
            </div>
        );
    }

    return (
        <div className="space-y-6 p-6 bg-background text-foreground">
            <div className="flex justify-between items-center">
                <h1 className="text-xl font-semibold">Your Workspace</h1>
                <Button 
                    onClick={() => createCanvas('untitled')}
                    disabled={isCreating}
                >
                    + Create New Canvas
                </Button>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-4 sm:space-y-0">
                <h2 className="text-xl font-bold tracking-tight">My Canvases</h2>
                <div className="flex items-center space-x-4 w-full sm:w-auto">
                    <Input
                        placeholder="Search"
                        value={searchQuery || ''}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full sm:w-64"
                    />
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setView('grid')}
                        className={view === 'grid' ? 'text-primary' : 'text-muted-foreground'}
                    >
                        <LayoutGrid className="h-5 w-5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setView('list')}
                        className={view === 'list' ? 'text-primary' : 'text-muted-foreground'}
                    >
                        <List className="h-5 w-5" />
                    </Button>
                </div>
            </div>

            {isLoading ? (
                view === 'grid' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {[...Array(4)].map((_, i) => (
                            <Skeleton key={i} className="h-32 rounded-lg" />
                        ))}
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Files</TableHead>
                                <TableHead>Last modified</TableHead>
                                <TableHead>Created at</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {[...Array(4)].map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )
            ) : canvasList && canvasList.length > 0 ? (
                <>
                    {view === 'grid' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                            {canvasList.map((canvas) => (
                                <Card
                                    key={canvas.id}
                                    className="hover:shadow-lg transition-shadow duration-200 cursor-pointer"
                                >
                                    <CardHeader className="text-center">
                                        <div className="flex justify-center mb-2">
                                            <Network className="h-8 w-8 text-muted-foreground" />
                                        </div>
                                        <CardTitle className="text-lg font-semibold truncate">
                                            {canvas.name}
                                        </CardTitle>
                                        <CardDescription className="text-sm text-muted-foreground">
                                            Last edited {formatDistanceToNow(new Date(canvas.updatedAt), { addSuffix: true })}
                                        </CardDescription>
                                    </CardHeader>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Files</TableHead>
                                    <TableHead>Last modified</TableHead>
                                    <TableHead>Created at</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {canvasList.map((canvas) => (
                                    <TableRow key={canvas.id} className="hover:bg-muted/50 cursor-pointer">
                                        <TableCell className="font-medium">
                                            <div className="flex items-center space-x-3">
                                                <Network className="h-5 w-5 text-muted-foreground" />
                                                <span>{canvas.name}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>-</TableCell>
                                        <TableCell>
                                            {formatDistanceToNow(new Date(canvas.updatedAt), { addSuffix: true })}
                                        </TableCell>
                                        <TableCell>
                                            {formatDistanceToNow(new Date(canvas.createdAt), { addSuffix: true })}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                    <div className="flex justify-end text-sm text-muted-foreground mt-4">
                        1-{canvasList?.length} of {canvasList?.length}
                    </div>
                </>
            ) : (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                    <Network className="h-12 w-12 mb-4" />
                    <p>No canvases found. Create your first one!</p>
                </div>
            )}
        </div>
    );
}

export { CanvasHome };