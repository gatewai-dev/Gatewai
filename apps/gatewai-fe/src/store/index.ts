import { configureStore } from '@reduxjs/toolkit'
import { useDispatch, useSelector } from 'react-redux'
import { nodesReducer } from './nodes'
import { nodeTemplatesAPI } from './node-templates'
import { setupListeners } from '@reduxjs/toolkit/query'

export const store = configureStore({
  reducer: {
    nodes: nodesReducer,
    [nodeTemplatesAPI.reducerPath]: nodeTemplatesAPI.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(nodeTemplatesAPI.middleware),
})

setupListeners(store.dispatch)


export type RootState = ReturnType<typeof store.getState>

export type AppDispatch = typeof store.dispatch


export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
export const useAppSelector = useSelector.withTypes<RootState>()