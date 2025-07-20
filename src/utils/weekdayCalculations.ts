export interface Expense {
  id?: number
  amount: number
  timestamp: string | number
  place_name?: string
  place_address?: string
  latitude?: number
  longitude?: number
}

export interface WeekdayData {
  name: string
  average: number
  percentage: number
}

export function calculateWeekdayAverages(expenses: Expense[]): WeekdayData[] {
  const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const weekdayTotals = new Array(7).fill(0)
  const weekdayCounts = new Array(7).fill(0)
  
  expenses.forEach(expense => {
    const date = new Date(expense.timestamp)
    const weekday = date.getDay() // 0 = Sunday, 1 = Monday, etc.
    weekdayTotals[weekday] += expense.amount
    weekdayCounts[weekday] += 1
  })
  
  // Calculate averages
  const averages = weekdayTotals.map((total, index) => 
    weekdayCounts[index] > 0 ? total / weekdayCounts[index] : 0
  )
  
  // Find max average for percentage calculation
  const maxAverage = Math.max(...averages)
  
  // Create chart data
  return weekdayNames.map((name, index) => ({
    name,
    average: averages[index],
    percentage: maxAverage > 0 ? (averages[index] / maxAverage) * 100 : 0
  }))
}

export function calculateWeekdayTotals(expenses: Expense[]): WeekdayData[] {
  const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const weekdayTotals = new Array(7).fill(0)
  
  expenses.forEach(expense => {
    const date = new Date(expense.timestamp)
    const weekday = date.getDay() // 0 = Sunday, 1 = Monday, etc.
    weekdayTotals[weekday] += expense.amount
  })
  
  // Find max total for percentage calculation
  const maxTotal = Math.max(...weekdayTotals)
  
  // Create chart data with totals instead of averages
  return weekdayNames.map((name, index) => ({
    name,
    average: weekdayTotals[index], // This will be the total, not average
    percentage: maxTotal > 0 ? (weekdayTotals[index] / maxTotal) * 100 : 0
  }))
}

export function calculateWeekdayDailyAverages(expenses: Expense[]): WeekdayData[] {
  if (expenses.length === 0) return []
  
  const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const weekdayTotals = new Array(7).fill(0)
  
  // Get date range to count weekday occurrences
  const dates = expenses.map(expense => new Date(expense.timestamp))
  const earliestDate = new Date(Math.min(...dates.map(d => d.getTime())))
  const latestDate = new Date(Math.max(...dates.map(d => d.getTime())))
  
  // Count total spending per weekday
  expenses.forEach(expense => {
    const date = new Date(expense.timestamp)
    const weekday = date.getDay()
    weekdayTotals[weekday] += expense.amount
  })
  
  // Count how many of each weekday occurred in the date range
  const weekdayCounts = new Array(7).fill(0)
  const currentDate = new Date(earliestDate)
  
  while (currentDate <= latestDate) {
    const weekday = currentDate.getDay()
    weekdayCounts[weekday]++
    currentDate.setDate(currentDate.getDate() + 1)
  }
  
  // Calculate average daily spending per weekday
  const averages = weekdayTotals.map((total, index) => 
    weekdayCounts[index] > 0 ? total / weekdayCounts[index] : 0
  )
  
  // Find max average for percentage calculation
  const maxAverage = Math.max(...averages)
  
  // Create chart data
  return weekdayNames.map((name, index) => ({
    name,
    average: averages[index],
    percentage: maxAverage > 0 ? (averages[index] / maxAverage) * 100 : 0
  }))
}