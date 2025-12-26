import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Loader2 } from "lucide-react";
import init from '@silvia-odwyer/photon';

type Photon = typeof import("@silvia-odwyer/photon");
export let photonInstance: Photon | undefined;
// In photon-loader.tsx or equivalent
let cachedInstance: Photon | null = null; // Cache the resolved instance

export function getPhotonInstance(): Promise<Photon | undefined> {
  if (cachedInstance) {
    return Promise.resolve(cachedInstance);
  }
}

interface PhotonContextValue {
  photon: Photon | null;
  isLoading: boolean;
  error: Error | null;
}

const PhotonContext = createContext<PhotonContextValue | undefined>(undefined);

interface PhotonProviderProps {
  children: ReactNode;
}

export const PhotonProvider: React.FC<PhotonProviderProps> = ({ children }) => {
  const [photon, setPhoton] = useState<Photon | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadPhoton = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Dynamic import of the browser-native module
        const photonModule = await import('@silvia-odwyer/photon');
        await photonModule.default();
        console.log({photonModule})
        // Store it for module access
        photonInstance = photonModule;
        if (!cancelled) {
          setPhoton(photonModule);
          setIsLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          const error = err instanceof Error ? err : new Error('Failed to load Photon WASM');
          setError(error);
          setIsLoading(false);
          console.error('Error loading Photon WASM:', error);
        }
      }
    };

    loadPhoton();

    return () => {
      cancelled = true;
    };
  }, []);

  const value: PhotonContextValue = {
    photon,
    isLoading,
    error,
  };

  return (
    <PhotonContext.Provider value={value}>
      {isLoading ? (
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="h-12 w-12 animate-spin" />
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-screen text-red-500">
          Error loading Photon: {error.message}
        </div>
      ) : (
        children
      )}
    </PhotonContext.Provider>
  );
};

// Custom hook to use the Photon context
export const usePhoton = (): PhotonContextValue => {
  const context = useContext(PhotonContext);
  
  if (context === undefined) {
    throw new Error('usePhoton must be used within a PhotonProvider');
  }
  
  return context;
};