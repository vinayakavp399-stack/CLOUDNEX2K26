import React, { useState, useEffect } from 'react';
import { Award, Phone, Sparkles, UserCheck, X, Maximize2 } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import vinayakPhoto from '../assets/vinayak_photo.jpg';

export default function TeamSection({ embedded = false, initialTab = 'coordinators' }) {
  const { isLight } = useTheme();
  const [activeTab, setActiveTab] = useState(initialTab === 'volunteers' ? 'volunteers' : 'coordinators');
  const [selectedCoordinator, setSelectedCoordinator] = useState(null);

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setSelectedCoordinator(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Coordinators Data (Faculty + Student)
  const facultyCoordinators = [
    {
      name: 'Ms. Usha T M',
      role: 'Faculty Coordinator',
      designation: 'Assistant Professor',
      department: 'Dept. of Cloud Computing and Business Systems',
      institution: 'GM University, Davangere',
      phone: '6361736961',
      displayPhone: '+91 63617 36961',
      image: null,
      initials: 'UT'
    },
    {
      name: 'Ms. Pooja K R',
      role: 'Faculty Coordinator',
      designation: 'Assistant Professor',
      department: 'Dept. of Cloud Computing and Business Systems',
      institution: 'GM University, Davangere',
      phone: '6363725690',
      displayPhone: '+91 63637 25690',
      image: null,
      initials: 'PK'
    }
  ];

  const studentCoordinators = [
    {
      name: 'Mr. Vinayak Pujar',
      role: 'Lead Student Coordinator',
      department: 'Dept. of Cloud Computing and Business Systems',
      institution: 'GM University',
      phone: '8088079573',
      displayPhone: '+91 80880 79573',
      image: vinayakPhoto,
      initials: 'VP'
    },
    {
      name: 'Mr. Darshan G M',
      role: 'Lead Student Coordinator',
      department: 'Dept. of Cloud Computing and Business Systems',
      institution: 'GM University',
      phone: '7676566133',
      displayPhone: '+91 76765 66133',
      image: null,
      initials: 'DG'
    }
  ];

  // Volunteers Data (Name + Dept)
  const volunteers = [
    { name: 'Kiran Kumar S', department: 'Dept. of Cloud Computing and Business Systems' },
    { name: 'Sneha Patil', department: 'Dept. of Cloud Computing and Business Systems' },
    { name: 'Mohammed Yusuf', department: 'Dept. of Cloud Computing and Business Systems' },
    { name: 'Ananya Hegde', department: 'Dept. of Cloud Computing and Business Systems' },
    { name: 'Rohan Deshmukh', department: 'Dept. of Cloud Computing and Business Systems' },
    { name: 'Priyanka R', department: 'Dept. of Cloud Computing and Business Systems' }
  ];

  const renderFacultyCard = (faculty, idx) => (
    <div
      key={idx}
      onClick={() => setSelectedCoordinator(faculty)}
      className={`rounded-2xl p-3.5 sm:p-4.5 border transition-all duration-300 hover:-translate-y-1 relative overflow-hidden group cursor-pointer ${
        isLight
          ? 'bg-white border-amber-300 shadow-sm shadow-slate-200/80 hover:border-amber-500 hover:shadow-lg'
          : 'bg-gradient-to-br from-slate-900/95 via-[#0d1322] to-slate-950 border-amber-500/30 hover:border-amber-400/60 hover:shadow-[0_0_25px_rgba(245,158,11,0.25)] shadow-black/40'
      }`}
    >
      <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl pointer-events-none transition-all ${
        isLight ? 'bg-amber-400/10 group-hover:bg-amber-400/20' : 'bg-amber-500/10 group-hover:bg-amber-500/20'
      }`} />

      {/* Top right hint */}
      <div className="absolute top-3 right-3 opacity-60 group-hover:opacity-100 transition-opacity">
        <span className={`text-[9px] font-mono-code font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1 ${
          isLight ? 'bg-amber-100 text-amber-900' : 'bg-amber-950/60 text-amber-300 border border-amber-500/30'
        }`}>
          <span>Card</span>
          <Maximize2 className="w-2.5 h-2.5" />
        </span>
      </div>

      <div className="flex items-start space-x-3 sm:space-x-3.5 relative z-10">
        {/* Profile Picture / Avatar */}
        <div className="relative shrink-0">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl p-0.5 bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-200 shadow-md shadow-amber-500/30 overflow-hidden">
            {faculty.image ? (
              <img
                src={faculty.image}
                alt={faculty.name}
                className="w-full h-full rounded-[14px] object-cover object-top"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            ) : (
              <div className={`w-full h-full rounded-[14px] flex items-center justify-center font-race font-black text-sm sm:text-lg ${
                isLight ? 'bg-amber-100 text-amber-950 border border-amber-300' : 'bg-slate-950 text-amber-300'
              }`}>
                {faculty.initials}
              </div>
            )}
          </div>
          <div className="absolute -bottom-1 -right-1 w-4 h-4 sm:w-4.5 sm:h-4.5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center text-[9px] shadow font-bold">
            <Award className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
          </div>
        </div>

        {/* Information */}
        <div className="min-w-0 flex-1">
          <span className={`text-[9px] font-race font-black uppercase tracking-wider block ${
            isLight ? 'text-amber-800' : 'text-amber-400'
          }`}>
            {faculty.role}
          </span>
          <h4 className={`font-race text-sm sm:text-base font-black truncate mt-0.5 group-hover:text-amber-500 transition-colors ${
            isLight ? 'text-slate-900' : 'text-white'
          }`}>
            {faculty.name}
          </h4>
          <p className={`text-[10px] sm:text-[11px] font-mono-code font-bold leading-tight mt-0.5 ${
            isLight ? 'text-slate-700' : 'text-slate-300'
          }`}>
            {faculty.designation}
          </p>
          <p className={`text-[9px] sm:text-[11px] font-mono-code mt-0.5 truncate ${
            isLight ? 'text-slate-600 font-semibold' : 'text-slate-400'
          }`}>
            {faculty.department}
          </p>

          {/* Direct Phone Call Button */}
          <div className="mt-2 sm:mt-2.5">
            <a
              href={`tel:${faculty.phone}`}
              onClick={(e) => e.stopPropagation()}
              className={`inline-flex items-center space-x-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg border text-[10px] sm:text-[11px] font-mono-code font-bold transition-all hover:scale-105 active:scale-95 ${
                isLight
                  ? 'bg-amber-50 hover:bg-amber-100 text-amber-950 border-amber-300 shadow-sm'
                  : 'bg-amber-950/60 hover:bg-amber-900/70 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-950/40'
              }`}
            >
              <Phone className="w-3 h-3 text-amber-600 dark:text-amber-500 shrink-0" />
              <span>{faculty.displayPhone}</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStudentCard = (student, idx) => (
    <div
      key={idx}
      onClick={() => setSelectedCoordinator(student)}
      className={`rounded-2xl p-3.5 sm:p-4.5 border transition-all duration-300 hover:-translate-y-1 relative overflow-hidden group cursor-pointer ${
        isLight
          ? 'bg-white border-sky-300 shadow-sm shadow-slate-200/80 hover:border-sky-500 hover:shadow-lg'
          : 'bg-gradient-to-br from-slate-900/95 via-[#091424] to-slate-950 border-cyan-500/30 hover:border-cyan-400/60 hover:shadow-[0_0_25px_rgba(0,245,255,0.25)] shadow-black/40'
      }`}
    >
      <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl pointer-events-none transition-all ${
        isLight ? 'bg-sky-400/10 group-hover:bg-sky-400/20' : 'bg-cyan-500/10 group-hover:bg-cyan-500/20'
      }`} />

      {/* Top right hint */}
      <div className="absolute top-3 right-3 opacity-60 group-hover:opacity-100 transition-opacity">
        <span className={`text-[9px] font-mono-code font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1 ${
          isLight ? 'bg-sky-100 text-sky-900' : 'bg-cyan-950/60 text-cyan-300 border border-cyan-500/30'
        }`}>
          <span>Card</span>
          <Maximize2 className="w-2.5 h-2.5" />
        </span>
      </div>

      <div className="flex items-start space-x-3 sm:space-x-3.5 relative z-10">
        {/* Profile Picture / Avatar */}
        <div className="relative shrink-0">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl p-0.5 bg-gradient-to-tr from-cyan-500 via-sky-400 to-indigo-300 shadow-md shadow-cyan-500/30 overflow-hidden">
            {student.image ? (
              <img
                src={student.image}
                alt={student.name}
                className="w-full h-full rounded-[14px] object-cover object-top"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            ) : (
              <div className={`w-full h-full rounded-[14px] flex items-center justify-center font-race font-black text-sm sm:text-lg ${
                isLight ? 'bg-sky-100 text-sky-950 border border-sky-300' : 'bg-slate-950 text-cyan-300'
              }`}>
                {student.initials}
              </div>
            )}
          </div>
          <div className="absolute -bottom-1 -right-1 w-4 h-4 sm:w-4.5 sm:h-4.5 rounded-full bg-cyan-400 text-slate-950 flex items-center justify-center text-[9px] shadow font-bold">
            ★
          </div>
        </div>

        {/* Information */}
        <div className="min-w-0 flex-1">
          <span className={`text-[9px] font-race font-black uppercase tracking-wider block ${
            isLight ? 'text-sky-800' : 'text-cyan-400'
          }`}>
            {student.role}
          </span>
          <h4 className={`font-race text-sm sm:text-base font-black truncate mt-0.5 group-hover:text-cyan-400 transition-colors ${
            isLight ? 'text-slate-900' : 'text-white'
          }`}>
            {student.name}
          </h4>
          <p className={`text-[9px] sm:text-[11px] font-mono-code mt-0.5 truncate ${
            isLight ? 'text-slate-600 font-semibold' : 'text-slate-400'
          }`}>
            {student.department}
          </p>

          {/* Direct Phone Call Button */}
          <div className="mt-2 sm:mt-2.5">
            <a
              href={`tel:${student.phone}`}
              onClick={(e) => e.stopPropagation()}
              className={`inline-flex items-center space-x-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg border text-[10px] sm:text-[11px] font-mono-code font-bold transition-all hover:scale-105 active:scale-95 ${
                isLight
                  ? 'bg-sky-50 hover:bg-sky-100 text-sky-950 border-sky-300 shadow-sm'
                  : 'bg-cyan-950/60 hover:bg-cyan-900/70 text-cyan-300 border-cyan-500/40 shadow-sm shadow-cyan-950/40'
              }`}
            >
              <Phone className="w-3 h-3 text-sky-600 dark:text-cyan-400 shrink-0" />
              <span>{student.displayPhone}</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <section id="team" className={`${embedded ? 'py-6' : 'py-3 sm:py-5'} max-w-6xl mx-auto px-4 sm:px-6 transition-colors`}>
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-4 sm:mb-6">
        <div className={`inline-flex items-center space-x-1.5 text-[9px] sm:text-[10px] font-race font-bold tracking-widest uppercase mb-1 px-2.5 py-0.5 rounded-full border shadow-sm ${
          isLight
            ? 'bg-amber-100/80 border-amber-300 text-amber-900'
            : 'bg-amber-950/50 border-amber-500/30 text-amber-400'
        }`}>
          <Sparkles className="w-3 h-3 text-amber-500 dark:text-amber-400" />
          <span>CLOUDNEX 2K26 CREW</span>
        </div>
        <h2 className={`text-2xl sm:text-3xl md:text-4xl font-race font-black uppercase tracking-wide ${
          isLight ? 'text-slate-900' : 'text-white'
        }`}>
          ORGANIZING <span className={isLight ? 'text-gradient-blue' : 'text-gradient-cloud'}>COMMITTEE</span>
        </h2>
        <p className={`text-[11px] sm:text-xs mt-1 leading-relaxed font-mono-code font-semibold ${
          isLight ? 'text-slate-700' : 'text-slate-400'
        }`}>
          Dept. of Cloud Computing and Business Systems, GM University &bull; IGNITRON 2K26
        </p>

        {/* Interactive Tabs: Coordinators | Volunteers */}
        <div className="flex items-center justify-center gap-2.5 mt-3 sm:mt-4">
          <button
            onClick={() => setActiveTab('coordinators')}
            className={`flex items-center space-x-1.5 px-4 sm:px-5 py-1.5 sm:py-2 rounded-xl font-race text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-sm ${
              activeTab === 'coordinators'
                ? isLight
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-md shadow-amber-500/30 border border-amber-400'
                  : 'bg-gradient-to-r from-amber-600 to-yellow-600 text-white shadow-amber-950/80 border border-amber-400/50'
                : isLight
                ? 'bg-white text-slate-800 hover:bg-amber-50 hover:text-amber-900 border border-slate-300 shadow-sm'
                : 'bg-slate-900/80 text-slate-300 hover:bg-slate-800 border border-white/10'
            }`}
          >
            <Award className="w-3.5 h-3.5 text-amber-300" />
            <span>Coordinators</span>
          </button>

          <button
            onClick={() => setActiveTab('volunteers')}
            className={`flex items-center space-x-1.5 px-4 sm:px-5 py-1.5 sm:py-2 rounded-xl font-race text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-sm ${
              activeTab === 'volunteers'
                ? isLight
                  ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-md shadow-emerald-500/30 border border-emerald-500'
                  : 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-emerald-950/80 border border-emerald-400/50'
                : isLight
                ? 'bg-white text-slate-800 hover:bg-emerald-50 hover:text-emerald-900 border border-slate-300 shadow-sm'
                : 'bg-slate-900/80 text-slate-300 hover:bg-slate-800 border border-white/10'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5 text-emerald-300" />
            <span>Volunteers</span>
          </button>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          VIEW 1: ONLY COORDINATORS (Two distinct rows like last time)
         ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'coordinators' && (
        <div className="space-y-4 sm:space-y-5 animate-fade-in">
          {/* Faculty Coordinators Block */}
          <div className="space-y-2.5">
            <div className={`flex items-center justify-between pb-1.5 border-b ${
              isLight ? 'border-amber-300' : 'border-amber-500/25'
            }`}>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-4 rounded-full bg-amber-500 shrink-0" />
                <h3 className={`font-race text-xs sm:text-sm font-black uppercase tracking-wide flex items-center gap-2 ${
                  isLight ? 'text-slate-900' : 'text-white'
                }`}>
                  <span>Faculty Coordinators</span>
                  <span className={`text-[9px] font-mono-code font-black px-2 py-0.5 rounded-full border ${
                    isLight ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-amber-500/10 text-amber-300 border-amber-400/30'
                  }`}>
                    CLOUD COMPUTING &amp; BUSINESS SYSTEMS
                  </span>
                </h3>
              </div>
              <span className="text-[10px] font-mono-code text-slate-500 hidden sm:inline">
                Tap card to view ID badge
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {facultyCoordinators.map(renderFacultyCard)}
            </div>
          </div>

          {/* Student Coordinators Block */}
          <div className="space-y-2.5">
            <div className={`flex items-center justify-between pb-1.5 border-b ${
              isLight ? 'border-sky-300' : 'border-cyan-500/25'
            }`}>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-4 rounded-full bg-sky-500 dark:bg-cyan-400 shrink-0" />
                <h3 className={`font-race text-xs sm:text-sm font-black uppercase tracking-wide flex items-center gap-2 ${
                  isLight ? 'text-slate-900' : 'text-white'
                }`}>
                  <span>Student Coordinators</span>
                  <span className={`text-[9px] font-mono-code font-black px-2 py-0.5 rounded-full border ${
                    isLight ? 'bg-sky-100 text-sky-900 border-sky-300' : 'bg-cyan-500/10 text-cyan-300 border-cyan-400/30'
                  }`}>
                    CLOUDNEX PIT WALL
                  </span>
                </h3>
              </div>
              <span className="text-[10px] font-mono-code text-slate-500 hidden sm:inline">
                Tap card to view ID badge
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {studentCoordinators.map(renderStudentCard)}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          VIEW 2: ONLY VOLUNTEERS (NAME + DEPARTMENT)
         ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'volunteers' && (
        <div className="space-y-3 animate-fade-in">
          <div className={`flex items-center justify-between pb-1.5 border-b ${
            isLight ? 'border-emerald-300' : 'border-emerald-500/25'
          }`}>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-4 rounded-full bg-emerald-500 dark:bg-emerald-400 shrink-0" />
              <h3 className={`font-race text-xs sm:text-sm font-black uppercase tracking-wide flex items-center gap-2 ${
                isLight ? 'text-slate-900' : 'text-white'
              }`}>
                <span>Volunteers</span>
                <span className={`text-[9px] font-mono-code font-black px-2 py-0.5 rounded-full border ${
                  isLight ? 'bg-emerald-100 text-emerald-900 border-emerald-300' : 'bg-emerald-500/10 text-emerald-300 border-emerald-400/30'
                }`}>
                  EVENT SUPPORT
                </span>
              </h3>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {volunteers.map((vol, idx) => (
              <div
                key={idx}
                className={`p-3 sm:p-3.5 rounded-xl border flex items-center space-x-3 transition-all duration-200 hover:-translate-y-0.5 ${
                  isLight
                    ? 'bg-white hover:bg-emerald-50/50 border-slate-200 hover:border-emerald-400 shadow-sm shadow-slate-200/60'
                    : 'bg-slate-900/80 hover:bg-slate-800/80 border-white/10 hover:border-emerald-500/30 shadow-sm'
                }`}
              >
                <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center font-race font-black text-xs shrink-0 ${
                  isLight ? 'bg-emerald-100 text-emerald-950 border border-emerald-300' : 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
                }`}>
                  <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className={`block font-race text-xs sm:text-sm font-black tracking-wide truncate ${
                    isLight ? 'text-slate-900' : 'text-white'
                  }`}>
                    {vol.name}
                  </span>
                  <span className={`block text-[10px] sm:text-[11px] font-mono-code font-semibold truncate mt-0.5 ${
                    isLight ? 'text-slate-600' : 'text-slate-400'
                  }`}>
                    {vol.department}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          COORDINATOR BIG NAME CARD / ID BADGE MODAL
         ════════════════════════════════════════════════════════════════════════ */}
      {selectedCoordinator && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in"
          onClick={() => setSelectedCoordinator(null)}
        >
          <div
            className={`relative w-full max-w-[320px] sm:max-w-sm max-h-[92vh] overflow-y-auto rounded-3xl border shadow-2xl p-4 sm:p-6 transition-all ${
              isLight
                ? 'bg-gradient-to-b from-white via-slate-50 to-slate-100 border-slate-300 text-slate-900 shadow-2xl'
                : 'bg-gradient-to-b from-[#0c1626] via-[#08101e] to-[#040812] border-cyan-500/50 text-white shadow-[0_0_50px_rgba(0,245,255,0.3)]'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Lanyard Clip Slot Graphic */}
            <div className="flex items-center justify-center mb-3">
              <div className={`w-14 sm:w-16 h-2 rounded-full border ${
                isLight ? 'bg-slate-300 border-slate-400' : 'bg-slate-800 border-white/20'
              }`} />
            </div>

            {/* Close Button */}
            <button
              onClick={() => setSelectedCoordinator(null)}
              className={`absolute top-4 right-4 p-1.5 rounded-full transition-colors cursor-pointer ${
                isLight
                  ? 'hover:bg-slate-200 text-slate-500 hover:text-slate-900'
                  : 'hover:bg-white/10 text-slate-400 hover:text-white'
              }`}
              title="Close Name Card"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Official Header Strip */}
            <div className="text-center mb-3.5">
              <div className="flex items-center justify-center space-x-1.5 text-[9px] sm:text-[10px] font-race font-bold tracking-widest text-cyan-500 uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                <span>GM UNIVERSITY &bull; IGNITRON 2K26</span>
              </div>
              <p className={`text-[9px] sm:text-[10px] font-mono-code font-bold tracking-wider uppercase mt-0.5 ${
                isLight ? 'text-slate-500' : 'text-slate-400'
              }`}>
                Official Paddock Pass &bull; Coordinator
              </p>
            </div>

            {/* Big High-Resolution Photo */}
            <div className="relative mx-auto w-36 h-44 sm:w-44 sm:h-52 rounded-2xl sm:rounded-3xl overflow-hidden border-2 shadow-2xl p-0.5 bg-gradient-to-tr from-cyan-500 via-sky-400 to-amber-300 mb-3.5">
              {selectedCoordinator.image ? (
                <img
                  src={selectedCoordinator.image}
                  alt={selectedCoordinator.name}
                  className="w-full h-full rounded-[14px] sm:rounded-[20px] object-cover object-top"
                />
              ) : (
                <div className={`w-full h-full rounded-[14px] sm:rounded-[20px] flex flex-col items-center justify-center font-race font-black ${
                  isLight ? 'bg-amber-50 text-amber-900' : 'bg-slate-950 text-cyan-300'
                }`}>
                  <span className="text-5xl">{selectedCoordinator.initials}</span>
                  <span className="text-[9px] font-mono-code mt-1 tracking-widest uppercase opacity-75">
                    {selectedCoordinator.role}
                  </span>
                </div>
              )}

              {/* Holographic Seal Pill */}
              <div className="absolute bottom-1.5 right-1.5 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md border border-cyan-400/50 text-cyan-300 font-race font-bold text-[8px] uppercase tracking-wider">
                VERIFIED
              </div>
            </div>

            {/* Details */}
            <div className="text-center space-y-1 mb-4">
              <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-race font-black uppercase tracking-wider border ${
                selectedCoordinator.role.includes('Faculty')
                  ? isLight
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                  : isLight
                  ? 'bg-sky-100 text-sky-900 border-sky-300'
                  : 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40'
              }`}>
                {selectedCoordinator.role}
              </span>

              <h3 className={`text-xl sm:text-2xl font-race font-black tracking-wide ${
                isLight ? 'text-slate-900' : 'text-white'
              }`}>
                {selectedCoordinator.name}
              </h3>

              {selectedCoordinator.designation && (
                <p className={`text-xs font-mono-code font-bold ${
                  isLight ? 'text-slate-700' : 'text-slate-300'
                }`}>
                  {selectedCoordinator.designation}
                </p>
              )}

              <p className={`text-xs font-mono-code font-semibold ${
                isLight ? 'text-slate-600' : 'text-slate-400'
              }`}>
                {selectedCoordinator.department}
              </p>

              <p className={`text-[10px] font-mono-code ${
                isLight ? 'text-slate-500' : 'text-slate-500'
              }`}>
                {selectedCoordinator.institution}
              </p>
            </div>

            {/* Contact Action: Direct Call Button */}
            <div className="flex items-center justify-center pt-2.5 border-t border-slate-200 dark:border-white/10">
              <a
                href={`tel:${selectedCoordinator.phone}`}
                className={`w-full inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl font-mono-code font-bold text-xs uppercase tracking-wider transition-all hover:scale-105 active:scale-95 shadow-md ${
                  isLight
                    ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-200'
                    : 'bg-gradient-to-r from-amber-600 to-yellow-600 text-white shadow-amber-950/80 border border-amber-400/40'
                }`}
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Call {selectedCoordinator.displayPhone}</span>
              </a>
            </div>

            {/* Bottom NFC Barcode / Paddock Pass Strip */}
            <div className="mt-3 pt-2 border-t border-dashed border-slate-300 dark:border-white/10 text-center">
              <p className="text-[8px] font-mono-code tracking-[0.2em] text-slate-400 uppercase">
                /// PASS ID: CLOUDNEX-2026-COORDINATOR ///
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
