# 🏎️ CLOUDNEX 2K26 — Next-Gen Cloud Engineering Challenge
### Formula 1 Racing-Themed Competition Portal
**Organized by: GM University, Department of Cloud Computing**  
**As part of: IGNITRON 2K26 & Student Affairs Council, Davangere, Karnataka**

---

## 🏁 Overview

**CLOUDNEX 2K26** is a live, full-stack competition portal that fuses the high-stakes thrill of **Formula 1 motorsport** with **modern cloud engineering, microservices, and chaos engineering**. Participants enter a live racing championship, progressing through three rigorous rounds, tracking real-time pit-wall telemetry, and battling for podium classification on the championship grid.

---

## ⚡ Championship Structure: Three-Round Race Track

1. **Round 1 — Architecture Design (`Polesitter Circuit Blueprint`)**
   - **Scenario**: Global F1 Telemetry Ingestion Mesh handling 500,000 real-time IoT events/second across 20 cars with sub-15ms edge latency.
   - **Deliverables**: System architecture diagram, data-flow pipeline, cloud service matrix, and security/cost optimization blueprint.
   - **Scoring**: Max 50 Marks (evaluated across 7 specialized cloud engineering rubrics).

2. **Round 2 — Build & Deploy (`Grand Prix Production Sprint`)**
   - **Scenario**: Containerized telemetry microservices & pit-wall streaming API.
   - **Deliverables**: GitHub repository, live deployed application URL (Render, Fly.io, AWS, etc.), Dockerfile, deployment instructions, and project ZIP archive.
   - **Mid-Season Elimination**: Race Control reviews submissions and score thresholds. Only qualifying teams advance to the Final Lap.

3. **Round 3 — Cloud Crisis Challenge (`Final Lap - Red Flag Emergency Protocol`)**
   - **Restricted to Qualified Teams**: Problem statement is confidential until dynamically triggered by the Race Director.
   - **Scenario**: Simulated catastrophe (sudden 10x traffic spike, cache stampede, DB replica desync, API rate exhaustion).
   - **Deliverables**: Hotfix patch, restored live application URL, Root Cause Analysis (RCA) post-mortem report, and incident defense.
   - **Scoring**: Max 50 Marks (Crisis Challenge: 30 Marks, Presentation & Defense: 20 Marks).

---

## 🛠️ Technology Stack

- **Frontend**: React 19, Vite, Tailwind CSS v4, Lucide Icons, Canvas Confetti.
- **Backend**: Python FastAPI, Uvicorn, HTTP Telemetry Stream & Polling for live race events, PyJWT, Bcrypt password hashing.
- **Database**: 
  - Direct integration with **MongoDB Atlas** via `MONGODB_URI`.
  - Automatic zero-configuration fallback to local persistent document store (`backend/data/`), allowing immediate out-of-the-box operation on any machine without local MongoDB daemon setup.
- **Testing**: PyTest with automated test coverage for authentication, round visibility, server-side submission deadlines, and elimination rules.

---

## 🔑 Pre-Seeded Championship Accounts

For testing, the database automatically initializes on startup with authentic accounts:

| Role | Username / Team ID | Password | Status |
|---|---|---|---|
| **Race Director (Admin)** | `race_director` | `Director@F1Cloud2026` | Chief Steward HQ |
| **Team 1 (Polesitter)** | `TEAM-RED-BULL-01` | `Password@123` | Active & Qualified for R3 |
| **Team 2 (Leader)** | `TEAM-MCLAREN-02` | `Password@123` | Active & Qualified for R3 |
| **Team 3 (NITK)** | `TEAM-FERRARI-03` | `Password@123` | Active & Qualified for R3 |
| **Team 4 (BMSCE)** | `TEAM-MERCEDES-04` | `Password@123` | Active (Round 2) |
| **Team 6 (Eliminated)** | `TEAM-WILLIAMS-06` | `Password@123` | Eliminated Post-R2 |

> *One-click login helper buttons are also provided directly on the login screen for testing.*

---

## 🚀 Quickstart Guide

### 1. Prerequisites
- **Node.js** (v18+) & **npm**
- **Python** (3.9+)

### 2. Backend Setup
```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Run automated test suite
python -m pytest

# Start FastAPI backend server (Runs on port 8000)
python run.py
```
*API interactive documentation will be available at: [http://localhost:8000/api/v1/docs](http://localhost:8000/api/v1/docs)*

### 3. Frontend Setup
```bash
cd frontend

# Install packages
npm install

# Start Vite development server (Runs on port 5173)
npm run dev
```
*Open your browser at: [http://localhost:5173](http://localhost:5173)*

---

## 🌐 Real-Time Telemetry & HTTP Event Stream

- **Endpoint**: `/api/v1/events/poll` (and `/events/poll`)
- Highly reliable, proxy-friendly HTTP telemetry stream with adaptive polling and cross-tab synchronization.
- Automatically synchronizes:
  - `ROUND_STATUS_CHANGED`: Live round activations and deadline countdowns.
  - `NEW_SUBMISSION`: Real-time submission counter increments on Race Director console.
  - `QUALIFICATIONS_UPDATED`: Live notification when a team is qualified for Round 3 or eliminated.
  - `LEADERBOARD_UPDATED`: Instant grid standings recalculations after evaluations.
  - `FORCE_LOGOUT`: Real-time single-device session enforcement.

---

## ⚖️ Evaluation Rubrics

### 🏁 Round 1 Marks Allocation (50 Marks Total)

| # | Evaluation Criteria | Description | Max Marks |
|---|---|---|:---:|
| 1 | **Cloud Architecture Design** | Correct architecture, component interactions, and suitability for the given problem | **12** |
| 2 | **Cloud Service Selection** | Appropriate selection of compute, database, storage, networking, and cloud services | **8** |
| 3 | **Scalability & Performance** | Handling peak users, traffic growth, load balancing, and resource scaling | **8** |
| 4 | **Security & Data Protection** | Authentication, access control, encryption, and protection of sensitive data | **7** |
| 5 | **High Availability & Fault Tolerance** | Redundancy, failure handling, backup, and disaster recovery | **7** |
| 6 | **Cost Optimization** | Cost-effective service selection and efficient resource utilization | **4** |
| 7 | **Technical Feasibility** | Practical implementation, justified design decisions, and compatibility of components | **4** |
| | **TOTAL** | | **50 Marks** |

### 🏁 Round 2 Marks Allocation (100 Marks Total)

| # | Evaluation Criteria | Description | Max Marks |
|---|---|---|:---:|
| 1 | **Application Functionality & API Implementation** | Required API endpoints, correct request/response handling, validation, and error handling | **15** |
| 2 | **Cloud Deployment & Accessibility** | Successful deployment, application accessibility, correct configuration, and service availability | **25** |
| 3 | **Database Integration** | Database connectivity, CRUD operations, data persistence, and correct query handling | **10** |
| 4 | **Containerization** | Correct Dockerfile, successful image build, container execution, and configuration | **10** |
| 5 | **Authentication & Security** | Authentication, authorization, secure credentials, IAM permissions, and protection against unauthorized access | **15** |
| 6 | **Object Storage Integration** | Successful file uploads, storage, retrieval, and appropriate access permissions | **10** |
| 7 | **Monitoring & Logging** | Application logs, error visibility, health checks, and basic monitoring configuration | **5** |
| 8 | **Reliability & Error Handling** | Handling invalid requests, service failures, and configuration or connection errors | **5** |
| 9 | **Cloud Configuration & Resource Management** | Correct networking, environment variables, resource configuration, and cleanup of unnecessary resources | **5** |
| | **TOTAL** | | **100 Marks** |

### 🏎️ Round 3 Final Round Marks Allocation (50 Marks Total)

| # | Evaluation Criteria | Description | Max Marks |
|---|---|---|:---:|
| 1 | **Crisis Challenge** | Incident mitigation, chaos engineering recovery, root cause diagnosis, and live system stabilization | **30** |
| 2 | **Presentation & Defense** | Post-mortem defense, stakeholder communication, architectural explanation, and steward Q&A | **20** |
| | **TOTAL** | | **50 Marks** |

---

## 📜 Official Rule Book & Competition Guidelines

The complete, official 9-page Rule Book for the **CLOUDNEX Hackathon (IGNITRON 2K26)** is integrated into the participant console with an embedded interactive viewer:
- **Downloadable PDF Path**: `/CLOUDNEX_HACKATHON_RULE_BOOK.pdf`
- **Features**:
  - Embedded PDF viewer with scrollbar visibility hidden and background scrolling locked while viewing.
  - Interactive searchable guide covering all 14 official rules.
  - Direct download and external tab viewing options.
  - Accessible directly via the **Rules & Regulations** button in the Participant Cockpit header.

### 👥 Event Coordinators

| Role | Coordinator | Contact Number |
|---|---|---|
| **Student Coordinator** | Mr. Vinayak Pujar | +91 8088079573 |
| **Student Coordinator** | Mr. Darshan G M | +91 7676566133 |
| **Faculty Coordinator** | Ms. Usha T M | +91 6361736961 |
| **Faculty Coordinator** | Ms. Pooja K R | +91 6363725690 |

- **Venue**: GM Business School Auditorium, New Building, GM University, Davangere, Karnataka.

---

## 🏛️ Credits & Institutional Affiliation

- **Department of Cloud Computing**, GM University, Davangere, Karnataka.
- **IGNITRON 2K26 Annual National Technical Symposium**.
- **Student Affairs Council**, GM University Campus, P.B. Road, Davangere - 577006.

