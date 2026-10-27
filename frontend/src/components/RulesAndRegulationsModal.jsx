import React, { useState, useEffect } from 'react';
import {
  Shield, X, Download, ExternalLink, FileText, BookOpen,
  CheckCircle2, Clock, Users, Award, AlertTriangle, Cpu,
  Phone, MapPin, ChevronRight, Sparkles, Layers
} from 'lucide-react';

export default function RulesAndRegulationsModal({ isOpen, onClose, defaultTab = 'pdf' }) {
  const [activeTab, setActiveTab] = useState(defaultTab); // 'pdf' or 'guide'
  const [searchFilter, setSearchFilter] = useState('');

  // Lock background dashboard scrolling & hide top navbar containing CLOUDNEX while modal is open
  useEffect(() => {
    if (!isOpen) return;

    // Hide top navbar header containing CLOUDNEX while PDF is open
    const topNavbar = document.querySelector('header');
    const prevDisplay = topNavbar ? topNavbar.style.display : '';
    if (topNavbar) {
      topNavbar.style.display = 'none';
    }

    const originalBodyOverflow = document.body.style.overflow;
    const originalDocOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      // Restore top navbar headline visibility after close
      if (topNavbar) {
        topNavbar.style.display = prevDisplay;
      }
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalDocOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const pdfUrl = '/CLOUDNEX_HACKATHON_RULE_BOOK.pdf';

  const sections = [
    {
      id: 1,
      title: '1. Event Description',
      tag: 'Overview',
      content: (
        <div className="space-y-2 text-slate-300">
          <p>
            <strong className="text-white">CLOUDNEX – Next-Gen Cloud Engineering Challenge</strong> is a dynamic, multi-round technical competition designed to test participants in the core domains of modern cloud computing.
          </p>
          <p>
            The event focuses on real-world problem solving, where participants will design scalable cloud architectures, build and deploy applications, and handle unexpected system challenges under pressure.
          </p>
          <p>
            Through a structured format of design, development, and crisis management, CLOUDNEX simulates the role of a cloud engineer in real industry scenarios.
          </p>
        </div>
      )
    },
    {
      id: 2,
      title: '2. Objectives',
      tag: 'Goals',
      content: (
        <ul className="space-y-1.5 text-slate-300 list-disc list-inside">
          <li><strong className="text-white">Promote innovation</strong> in cloud computing, system design, and architecture.</li>
          <li><strong className="text-white">Provide hands-on experience</strong> in building, deploying, and managing cloud applications.</li>
          <li><strong className="text-white">Develop skills</strong> in scalability, performance optimization, security, and fault tolerance.</li>
          <li><strong className="text-white">Encourage practical problem-solving</strong>, teamwork, and clear technical communication.</li>
        </ul>
      )
    },
    {
      id: 3,
      title: '3. Eligibility and Team Formation',
      tag: 'Teams',
      content: (
        <div className="space-y-2 text-slate-300">
          <ul className="space-y-1.5 list-disc list-inside">
            <li>The event is open to students across India.</li>
            <li>Each team must consist of <strong className="text-cyan-300">3–4 members</strong>.</li>
            <li>Each team should nominate one member as the primary point of contact for official communication.</li>
            <li>Registration details must be accurate. Any change in team membership must be approved by the event coordinators.</li>
            <li>Team members may be from the same or different institutions. Each member must carry a <strong className="text-amber-300">valid college ID card</strong> on the event day.</li>
          </ul>
        </div>
      )
    },
    {
      id: 4,
      title: '4. Registration Details',
      tag: 'Registration',
      content: (
        <ul className="space-y-1.5 text-slate-300 list-disc list-inside">
          <li><strong>Registration link:</strong> To be announced.</li>
          <li><strong>Registration fee:</strong> To be announced.</li>
          <li><strong>Registration deadline:</strong> To be announced.</li>
        </ul>
      )
    },
    {
      id: 5,
      title: '5. Attendance, Availability and Event Conflicts',
      tag: 'Attendance',
      content: (
        <div className="space-y-2 text-slate-300">
          <p>
            All registered participants are expected to remain available for the complete event duration and actively participate in their assigned rounds. Teams should plan their schedules in advance and avoid registering for another event or activity that overlaps with CLOUDNEX 2K26.
          </p>
          <ul className="space-y-1.5 list-disc list-inside">
            <li>If a participant has registered for another event, competition, or activity that may conflict with CLOUDNEX, they must inform the Faculty Coordinator or a Student Coordinator in advance—preferably before the event day.</li>
            <li>Teams must notify coordinators as early as possible if any member anticipates a scheduling conflict, late arrival, or inability to participate. This helps organizers plan rounds and avoid disruption.</li>
            <li>Failure to communicate a conflict in advance may affect the team’s participation, timing, or eligibility at the organizers’ discretion.</li>
          </ul>
        </div>
      )
    },
    {
      id: 6,
      title: '6. Event Duration and Format (3 Progressive Rounds)',
      tag: 'Rounds',
      content: (
        <div className="space-y-4 text-slate-300">
          <p>
            The event is a one-day event of approximately <strong className="text-cyan-300">6 hours</strong>. Problem statements and round-specific instructions will be released according to the event schedule. The indicative time allocation is:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-900/90 border border-cyan-500/30">
              <span className="text-cyan-400 font-race font-bold uppercase block text-[11px]">Round 1: 45 Minutes</span>
              <strong className="text-white text-sm block mt-0.5">Architecture Design: Polesitter Circuit Blueprint</strong>
              <p className="mt-1 text-slate-400">Design secure, scalable, fault-tolerant cloud architecture. Submit animated GIF diagram (&le;2MB) and scope sheet.</p>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/90 border border-red-500/30">
              <span className="text-red-400 font-race font-bold uppercase block text-[11px]">Round 2: 3h 45m</span>
              <strong className="text-white text-sm block mt-0.5">Build &amp; Deploy: Pit Stop Deployment</strong>
              <p className="mt-1 text-slate-400">Build &amp; deploy working application to AWS, Azure, or GCP. Submit live public HTTPS URL + GitHub repo. Localhost not accepted.</p>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/90 border border-amber-500/30">
              <span className="text-amber-400 font-race font-bold uppercase block text-[11px]">Evaluation: 30 Minutes</span>
              <strong className="text-white text-sm block mt-0.5">Scoring &amp; Elimination</strong>
              <p className="mt-1 text-slate-400">Combined R1 &amp; R2 evaluation. Only top-performing teams advance to Round 3.</p>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/90 border border-emerald-500/30">
              <span className="text-emerald-400 font-race font-bold uppercase block text-[11px]">Round 3: 1h 30m</span>
              <strong className="text-white text-sm block mt-0.5">Cloud Crisis Challenge: The Final Lap</strong>
              <p className="mt-1 text-slate-400">Qualified teams respond to simulated cloud incident &amp; demonstrate recovery and troubleshooting.</p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-white/10 text-xs">
            <strong className="text-white block font-race uppercase mb-1">Problem Statements:</strong>
            <p className="text-slate-400 leading-relaxed">
              Problem statements are scenario-based and grouped into three levels: <strong>Easy, Intermediate, and Hard (15 problems each)</strong>. All problems within a level carry equal weightage. Teams choose one problem statement at the start of Round 1, which carries through all rounds. Organizers may limit selection per problem, and problem statements cannot be changed once Round 1 begins.
            </p>
          </div>
        </div>
      )
    },
    {
      id: 7,
      title: '7. Elimination Rule',
      tag: 'Elimination',
      content: (
        <p className="text-slate-300 leading-relaxed">
          After Round 2, teams will be evaluated and an elimination decision will be made. Round 1 and Round 2 scores are combined for this decision. <strong className="text-red-400">Only the top-performing teams selected by the judges will advance to Round 3.</strong> The number of qualifying teams will be announced by the organizers.
        </p>
      )
    },
    {
      id: 8,
      title: '8. Judging Criteria & Tie-Breaker',
      tag: 'Judging',
      content: (
        <div className="space-y-2 text-slate-300">
          <ul className="space-y-1.5 list-disc list-inside">
            <li><strong className="text-white">Innovation &amp; Design:</strong> Creativity, suitability, and quality of the architecture or solution.</li>
            <li><strong className="text-white">Functionality:</strong> Working implementation and successful demonstration/deployment.</li>
            <li><strong className="text-white">Scalability &amp; Optimization:</strong> Efficient resource use and ability to handle increased demand.</li>
            <li><strong className="text-white">Security &amp; Reliability:</strong> Appropriate protection, fault tolerance, and recovery planning.</li>
            <li><strong className="text-white">Problem-Solving:</strong> Troubleshooting, decision-making, and response to the assigned challenge.</li>
            <li><strong className="text-white">Presentation &amp; Clarity:</strong> Clear explanation, teamwork, and justification of technical decisions.</li>
            <li><strong className="text-amber-300">Tie-breaker:</strong> If teams are tied, the team with the higher Round 3 score ranks higher; if still tied, the higher Functionality score decides.</li>
          </ul>
          <p className="text-xs text-red-400 font-bold italic pt-1">The judges’ decision is final and binding.</p>
        </div>
      )
    },
    {
      id: 9,
      title: '9. Optional Bonus',
      tag: 'Bonus',
      content: (
        <p className="text-slate-300 leading-relaxed">
          Relevant and functional <strong className="text-cyan-300">blockchain integration</strong> may earn bonus points at the judges’ discretion. Teams must explain why blockchain is appropriate for their solution; merely mentioning or adding an unrelated blockchain component will not guarantee bonus points.
        </p>
      )
    },
    {
      id: 10,
      title: '10. Cloud Accounts and Technical Preparation',
      tag: 'Cloud Prep',
      content: (
        <ul className="space-y-1.5 text-slate-300 list-disc list-inside">
          <li>Participants should create and test any required cloud-provider accounts before the event.</li>
          <li>Teams may use any one of <strong className="text-white">Amazon Web Services (AWS), Google Cloud Platform (GCP) or Microsoft Azure</strong> as their primary cloud provider. Multi-provider services are allowed if shown clearly in the architecture.</li>
          <li>Participants are responsible for account access, credentials, quotas, and any cloud usage charges. Organizers cannot guarantee that a third-party provider will approve or activate an account during the event.</li>
          <li><strong className="text-amber-300">Free-tier or student credits</strong> are recommended. Teams should set billing/budget alerts and delete or stop resources after the event to avoid charges.</li>
          <li>Teams must bring their own laptops and chargers. A mobile hotspot is recommended as a backup internet connection.</li>
        </ul>
      )
    },
    {
      id: 11,
      title: '11. Submission and Team Conduct',
      tag: 'Conduct',
      content: (
        <ul className="space-y-1.5 text-slate-300 list-disc list-inside">
          <li>Submit work using the method and before the deadline announced by the organizers.</li>
          <li>Ensure submitted links and repositories are accessible to judges and do not expose secrets or private personal information.</li>
          <li>Use only dummy or synthetic data. Real personal, health, financial or identity data must not be used.</li>
          <li><strong className="text-cyan-300">AI assistants (such as ChatGPT, Claude, or GitHub Copilot)</strong> may be used. Teams must be able to explain every part of their solution, and any AI-generated feature must be labelled as AI-assisted.</li>
          <li>Open-source libraries and starter templates are allowed, but the solution itself must be built during the event. Pre-built projects will be disqualified.</li>
          <li>Teams must present their own work, acknowledge third-party libraries, and avoid plagiarism or unauthorized access.</li>
          <li>Testing or failure simulation must remain within the team’s own application. Do not attack public services or other participants’ infrastructure.</li>
          <li>Follow instructions from faculty, student coordinators, volunteers, and judges. Violations may result in disqualification.</li>
        </ul>
      )
    },
    {
      id: 12,
      title: '12. Event Date and Venue',
      tag: 'Venue',
      content: (
        <div className="p-3.5 rounded-xl bg-slate-900 border border-white/10 space-y-1.5 text-xs text-slate-300">
          <div><strong className="text-white">Date:</strong> To be announced / confirmed by the organizers.</div>
          <div><strong className="text-white">Reporting time:</strong> To be announced by the organizers.</div>
          <div className="flex items-start space-x-2 pt-1 text-cyan-300">
            <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
            <span><strong>Venue:</strong> GM Business School Auditorium, New Building, GM University, Davangere, Karnataka.</span>
          </div>
        </div>
      )
    },
    {
      id: 13,
      title: '13. Prizes and Certificates',
      tag: 'Prizes',
      content: (
        <ul className="space-y-1.5 text-slate-300 list-disc list-inside">
          <li>Exciting prizes will be awarded to the winning teams, as announced by the organizers.</li>
          <li>Participation certificates will be provided in accordance with the event’s completion and attendance requirements.</li>
        </ul>
      )
    },
    {
      id: 14,
      title: '14. Event Coordinators',
      tag: 'Contacts',
      content: (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-900 border border-red-500/30">
              <span className="text-[10px] font-race text-red-400 font-bold uppercase block">Student Coordinators</span>
              <div className="mt-1 space-y-1 text-white">
                <div className="flex items-center justify-between">
                  <span>Mr. Vinayak Pujar</span>
                  <a href="tel:8088079573" className="text-cyan-400 hover:underline font-mono-code font-bold">8088079573</a>
                </div>
                <div className="flex items-center justify-between">
                  <span>Mr. Darshan G M</span>
                  <a href="tel:7676566133" className="text-cyan-400 hover:underline font-mono-code font-bold">7676566133</a>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900 border border-cyan-500/30">
              <span className="text-[10px] font-race text-cyan-400 font-bold uppercase block">Faculty Coordinators</span>
              <div className="mt-1 space-y-1 text-white">
                <div className="flex items-center justify-between">
                  <span>Ms. Usha T M</span>
                  <a href="tel:6361736961" className="text-cyan-400 hover:underline font-mono-code font-bold">6361736961</a>
                </div>
                <div className="flex items-center justify-between">
                  <span>Ms. Pooja K R</span>
                  <a href="tel:6363725690" className="text-cyan-400 hover:underline font-mono-code font-bold">6363725690</a>
                </div>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-slate-400">
            <strong>Institution:</strong> GM University, P.B. Road, Davangere, Karnataka.<br />
            <em>The organizers may clarify or update operational details when necessary. Important changes will be communicated through official event channels.</em>
          </p>
        </div>
      )
    }
  ];

  const filteredSections = searchFilter.trim()
    ? sections.filter(s =>
        s.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
        s.tag.toLowerCase().includes(searchFilter.toLowerCase())
      )
    : sections;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 bg-black/95 backdrop-blur-md animate-fade-in overflow-hidden select-none overscroll-contain"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative max-w-6xl w-full h-[96vh] rounded-2xl bg-slate-950 border border-cyan-500/30 shadow-2xl overflow-hidden flex flex-col no-scrollbar">
        
        {/* Header */}
        <div className="p-3 sm:p-4 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-red-950/60 border border-red-500/40 flex items-center justify-center text-red-400 shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-race font-bold uppercase tracking-wider text-red-400">
                  IGNITRON 2K26 &bull; GM UNIVERSITY
                </span>
                <span className="px-1.5 py-0.2 bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded text-[9px] font-mono-code">
                  OFFICIAL
                </span>
              </div>
              <h3 className="font-race text-sm sm:text-lg font-black text-white">
                OFFICIAL RULES &amp; REGULATIONS
              </h3>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* View Switcher Tabs */}
            <div className="flex items-center p-0.5 rounded-lg bg-slate-900 border border-white/10 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('pdf')}
                className={`px-3 py-1.5 rounded-md font-mono-code font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                  activeTab === 'pdf'
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>PDF View</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('guide')}
                className={`px-3 py-1.5 rounded-md font-mono-code font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                  activeTab === 'guide'
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>All 14 Rules</span>
              </button>
            </div>

            {/* Download PDF button */}
            <a
              href={pdfUrl}
              download="CLOUDNEX_HACKATHON_RULE_BOOK.pdf"
              title="Download Official Rule Book PDF"
              className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/10 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4 text-cyan-400" />
            </a>

            {/* Open in new tab */}
            <a
              href={pdfUrl}
              target="_blank"
              rel="noreferrer"
              title="Open PDF in new tab"
              className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/10 transition-colors cursor-pointer"
            >
              <ExternalLink className="w-4 h-4 text-amber-400" />
            </a>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        {activeTab === 'pdf' ? (
          <div className="flex-1 overflow-hidden bg-slate-950 relative w-full h-full min-h-[500px] no-scrollbar">
            <iframe
              src={`${pdfUrl}#toolbar=1&navpanes=0&scrollbar=0`}
              title="CLOUDNEX Hackathon Official Rule Book PDF"
              className="w-full h-full border-0 no-scrollbar"
              scrolling="no"
              style={{
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
              }}
            />
          </div>
        ) : (
          <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 no-scrollbar">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <span className="text-xs font-mono-code text-cyan-400">
                14 OFFICIAL COMPETITION SECTIONS
              </span>
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search rules (e.g. Round 1, AI, criteria)..."
                className="bg-slate-900 border border-white/10 rounded-lg px-3 py-1 text-xs text-white placeholder-slate-500 font-mono-code focus:outline-none focus:border-cyan-400 w-64"
              />
            </div>

            <div className="space-y-4">
              {filteredSections.map((sec) => (
                <div key={sec.id} className="p-4 rounded-xl bg-slate-900/70 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-race text-sm sm:text-base font-black text-white flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-full bg-cyan-400" />
                      <span>{sec.title}</span>
                    </h4>
                    <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-white/10 text-[10px] font-mono-code text-slate-300 uppercase">
                      {sec.tag}
                    </span>
                  </div>
                  <div className="pt-1 text-xs sm:text-sm font-sans leading-relaxed">
                    {sec.content}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-white/10 bg-slate-900/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-mono-code text-slate-400">
          <div className="flex items-center space-x-2">
            <span className="text-cyan-400 font-bold">&bull; GM UNIVERSITY &bull;</span>
            <span>IGNITRON 2K26 CLOUDNEX HACKATHON</span>
          </div>
          <div className="flex items-center space-x-3">
            <a
              href={pdfUrl}
              download="CLOUDNEX_HACKATHON_RULE_BOOK.pdf"
              className="px-3 py-1.5 rounded-lg bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300 border border-cyan-500/40 text-xs font-race font-bold uppercase transition-colors flex items-center space-x-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF</span>
            </a>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-race font-bold text-xs uppercase cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
