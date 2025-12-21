import './App.css'
import { AppRouter } from './Router';
import '@xyflow/react/dist/style.css';
import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import { Provider as StoreProvider } from 'react-redux';
import { store } from './store';

const queryClient = new QueryClient()

function App() {
  return (
    <StoreProvider store={store} >
    <QueryClientProvider client={queryClient}>
      <AppRouter />
    </QueryClientProvider>
    </StoreProvider>
  )
}

export default App
