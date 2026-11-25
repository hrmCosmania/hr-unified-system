import { useCallback, useEffect, useState } from 'react'

// โหลดข้อมูลแบบ async พร้อม reload — ใช้ร่วมกันทุกหน้า
export function useLoad(fn, deps = []) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(() => fn().then(setData).catch((e) => setError(e.message || String(e))), deps)
  useEffect(() => { run() }, [run])
  return [data, run, error]
}
