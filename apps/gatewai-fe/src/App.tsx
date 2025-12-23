import './App.css'
import { AppRouter } from './Router';
import '@xyflow/react/dist/style.css';
import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import { Provider as StoreProvider } from 'react-redux';
import { store } from './store';
import { CanvasListProvider } from './routes/canvas/ctx/canvas-list.ctx';
import { CanvasCreationProvider } from './routes/canvas/ctx/canvas-new.ctx';
import { Toaster } from './components/ui/sonner';

const queryClient = new QueryClient()

function App() {
  return (<>
    <StoreProvider store={store} >
      <QueryClientProvider client={queryClient}>
        <CanvasListProvider>
          <CanvasCreationProvider>
            <AppRouter />
          </CanvasCreationProvider>
        </CanvasListProvider>
      </QueryClientProvider>
    </StoreProvider>
    <Toaster />
    </>
  )
}

export default App
