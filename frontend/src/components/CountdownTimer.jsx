import React, { useState, useEffect, useRef } from 'react';
import { Clock, AlertCircle } from 'lucide-react';

export const parseUtcDate = (val) => {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  const str = String(val).trim();
  const hasTimezone = str.endsWith('Z') || str.includes('+') || (str.split('-').length > 3);
  const formatted = hasTimezone ? str : `${str}Z`;
  const parsed = new Date(formatted).getTime();
  return isNaN(parsed) ? new Date(str).getTime() : parsed;
};

export default function CountdownTimer({ targetDate, title = "LAP TIME REMAINING", onExpire }) {
  const [timeLeft, setTimeLeft] = useState({
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: false
  });

  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  const hasExpiredRef = useRef(false);
  const prevSecRef = useRef(null);
  const lastExpiredTargetRef = useRef(null);

  useEffect(() => {
    if (!targetDate) return;

    if (lastExpiredTargetRef.current !== targetDate) {
      hasExpiredRef.current = false;
    }
    prevSecRef.current = null;

    function calculate() {
      const now = Date.now();
      const target = parseUtcDate(targetDate);
      const difference = target - now;

      if (difference <= 0) {
        if (!hasExpiredRef.current && lastExpiredTargetRef.current !== targetDate) {
          hasExpiredRef.current = true;
          lastExpiredTargetRef.current = targetDate;
          setTimeLeft({ hours: 0, minutes: 0, seconds: 0, isExpired: true });
          if (onExpireRef.current) {
            onExpireRef.current();
          }
        } else {
          setTimeLeft(prev => prev.isExpired ? prev : { hours: 0, minutes: 0, seconds: 0, isExpired: true });
        }
        return;
      }

      const totalSec = Math.ceil(difference / 1000);
      if (prevSecRef.current === totalSec) {
        return; // Skip re-render if second hasn't changed
      }
      prevSecRef.current = totalSec;

      const hours = Math.floor(difference / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeLeft({ hours, minutes, seconds, isExpired: false });
    }

    calculate();
    const interval = setInterval(calculate, 250);
    return () => clearInterval(interval);
  }, [targetDate]);

  if (!targetDate) {
    return (
      <div className="flex items-center space-x-2 text-slate-400 font-mono-code text-xs px-3 py-1.5 bg-slate-900/60 rounded border border-white/5">
        <Clock className="w-3.5 h-3.5 text-slate-500" />
        <span>NO ACTIVE DEADLINE CONFIGURED</span>
      </div>
    );
  }

  const pad = (n) => String(n).padStart(2, '0');

  return (
    <div className={`inline-flex items-center space-x-3 px-4 py-2 rounded-lg border ${
      timeLeft.isExpired 
        ? 'bg-red-950/40 border-red-800 text-red-400' 
        : 'bg-slate-950/80 border-cyan-500/30 text-white shadow-lg shadow-cyan-950/20'
    }`}>
      <div className="flex items-center space-x-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
            timeLeft.isExpired ? 'bg-red-500' : 'bg-cyan-400'
          }`} />
          <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
            timeLeft.isExpired ? 'bg-red-500' : 'bg-cyan-500'
          }`} />
        </span>
        <span className="text-[11px] font-race uppercase tracking-wider text-slate-300 font-bold">
          {title}
        </span>
      </div>

      <div className="flex items-center space-x-1 font-mono-code text-base font-black">
        {timeLeft.isExpired ? (
          <span className="text-red-500 font-race text-sm tracking-wider flex items-center space-x-1">
            <AlertCircle className="w-4 h-4 mr-1" />
            CHECKERED FLAG &bull; TIME EXPIRED
          </span>
        ) : (
          <>
            <div className="bg-slate-900 px-2 py-0.5 rounded border border-white/10 text-cyan-300">
              {pad(timeLeft.hours)}
              <span className="text-[9px] text-slate-400 block text-center font-sans font-normal">HR</span>
            </div>
            <span className="text-cyan-400 text-sm font-bold animate-pulse">:</span>
            <div className="bg-slate-900 px-2 py-0.5 rounded border border-white/10 text-cyan-300">
              {pad(timeLeft.minutes)}
              <span className="text-[9px] text-slate-400 block text-center font-sans font-normal">MIN</span>
            </div>
            <span className="text-cyan-400 text-sm font-bold animate-pulse">:</span>
            <div className="bg-slate-900 px-2 py-0.5 rounded border border-white/10 text-red-400">
              {pad(timeLeft.seconds)}
              <span className="text-[9px] text-slate-400 block text-center font-sans font-normal">SEC</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
