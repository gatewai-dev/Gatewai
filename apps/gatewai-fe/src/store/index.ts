import { configureStore } from '@reduxjs/toolkit'
import { useDispatch, useSelector } from 'react-redux'
import { nodesReducer } from './nodes'
import { nodeTemplatesAPI } from './node-templates'
import { setupListeners } from '@reduxjs/toolkit/query'
import { reactFlowReducer } from './rfstate'
import { handlesReducer } from './handles'
import { edgesReducer } from './edges'
import { assetsAPI } from './assets'
import { canvasListAPI } from './canvas-list'
import { tasksReducer } from './tasks'
import { canvasDetailsAPI } from './canvas'

export const store = configureStore({
  reducer: {
    nodes: nodesReducer,
    handles: handlesReducer,
    edges: edgesReducer,
    reactFlow: reactFlowReducer,
    tasks: tasksReducer,
    [nodeTemplatesAPI.reducerPath]: nodeTemplatesAPI.reducer,
    [assetsAPI.reducerPath]: assetsAPI.reducer,
    [canvasListAPI.reducerPath]: canvasListAPI.reducer,
    [canvasDetailsAPI.reducerPath]: canvasDetailsAPI.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware()
      .concat(nodeTemplatesAPI.middleware)
      .concat(assetsAPI.middleware)
      .concat(canvasListAPI.middleware)
      .concat(canvasDetailsAPI.middleware)
})

setupListeners(store.dispatch)


export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch


export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
export const useAppSelector = useSelector.withTypes<RootState>()