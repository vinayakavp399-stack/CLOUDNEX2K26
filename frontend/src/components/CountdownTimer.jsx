import React, { useState, useEffect, useRef } from 'react';
import { Clock, AlertCircle } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

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
  const { isLight } = useTheme();
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
      const skew = (typeof window !== 'undefined' && window.__cloudnex_server_time_skew) || 0;
      const now = Date.now() + skew;
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
    <div className={`inline-flex items-center space-x-3 px-4 py-2 rounded-lg border transition-colors ${
      timeLeft.isExpired 
        ? isLight ? 'bg-red-50 border-red-300 text-red-700' : 'bg-red-950/40 border-red-800 text-red-400' 
        : isLight ? 'bg-white border-sky-300 text-slate-900 shadow-md' : 'bg-slate-950/80 border-cyan-500/30 text-white shadow-lg shadow-cyan-950/20'
    }`}>
      <div className="flex items-center space-x-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
            timeLeft.isExpired ? 'bg-red-500' : isLight ? 'bg-sky-500' : 'bg-cyan-400'
          }`} />
          <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
            timeLeft.isExpired ? 'bg-red-500' : isLight ? 'bg-sky-600' : 'bg-cyan-500'
          }`} />
        </span>
        <span className={`text-[11px] font-race uppercase tracking-wider font-bold ${
          isLight ? 'text-slate-700' : 'text-slate-300'
        }`}>
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
            <div className={`px-2 py-0.5 rounded border ${
              isLight ? 'bg-sky-50/80 border-sky-200 text-sky-800' : 'bg-slate-900 border-white/10 text-cyan-300'
            }`}>
              {pad(timeLeft.hours)}
              <span className={`text-[9px] block text-center font-sans font-normal ${
                isLight ? 'text-slate-500' : 'text-slate-400'
              }`}>HR</span>
            </div>
            <span className={`text-sm font-bold animate-pulse ${
              isLight ? 'text-sky-600' : 'text-cyan-400'
            }`}>:</span>
            <div className={`px-2 py-0.5 rounded border ${
              isLight ? 'bg-sky-50/80 border-sky-200 text-sky-800' : 'bg-slate-900 border-white/10 text-cyan-300'
            }`}>
              {pad(timeLeft.minutes)}
              <span className={`text-[9px] block text-center font-sans font-normal ${
                isLight ? 'text-slate-500' : 'text-slate-400'
              }`}>MIN</span>
            </div>
            <span className={`text-sm font-bold animate-pulse ${
              isLight ? 'text-sky-600' : 'text-cyan-400'
            }`}>:</span>
            <div className={`px-2 py-0.5 rounded border ${
              isLight ? 'bg-red-50 border-red-200 text-red-700' : 'bg-slate-900 border-white/10 text-red-400'
            }`}>
              {pad(timeLeft.seconds)}
              <span className={`text-[9px] block text-center font-sans font-normal ${
                isLight ? 'text-slate-500' : 'text-slate-400'
              }`}>SEC</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
