import { createSlice } from '@reduxjs/toolkit'

export const updateSiteDisplay = createSlice({
  name: 'siteDisplay',
  initialState: {
    value: "",
  },
  reducers: {
    update: (state, action) => {
      state.value = action.payload
    },
  },
})

// Action creators are generated for each case reducer function
export const { update } = updateSiteDisplay.actions

export default updateSiteDisplay.reducer