const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** A postmark's date, the way a counter stamp sets it: "10 Oct 26". */
export function postmarkDate(unixSeconds: number): string {
  const date = new Date(unixSeconds * 1000)
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${String(date.getFullYear()).slice(2)}`
}
