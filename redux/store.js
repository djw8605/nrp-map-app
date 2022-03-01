import { configureStore } from '@reduxjs/toolkit'
import updateTimeReducer  from './updateTime'
import updateSiteDisplay from './siteDisplay'

export default configureStore({
  reducer: {
    updateTime: updateTimeReducer,
    siteDisplay: updateSiteDisplay,
  },
})