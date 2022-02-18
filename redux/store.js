import { configureStore } from '@reduxjs/toolkit'
import updateTimeReducer  from './updateTime'

export default configureStore({
  reducer: {
    updateTime: updateTimeReducer
  },
})