--
-- PostgreSQL database dump
--

\restrict 6cLnMK6ief45NiO0upFesyCJd6IjRMQJZW3kIrUUFyZB9d2Q21CpojFtt6AR5fV

-- Dumped from database version 18.3
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: NominationStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."NominationStatus" AS ENUM (
    'DRAFT',
    'SUBMITTED',
    'APPROVED',
    'REJECTED'
);


--
-- Name: NotificationStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."NotificationStatus" AS ENUM (
    'UNREAD',
    'READ'
);


--
-- Name: ReviewDecision; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ReviewDecision" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
);


--
-- Name: ReviewLevel; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ReviewLevel" AS ENUM (
    'DONVI',
    'KHOA',
    'TRUONG'
);


--
-- Name: Role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Role" AS ENUM (
    'ADMIN',
    'CANBO',
    'GIANGVIEN',
    'SINHVIEN',
    'HOIDONG'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: AcademicYear; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AcademicYear" (
    id integer NOT NULL,
    "yearName" text NOT NULL,
    "startDate" timestamp(3) without time zone NOT NULL,
    "endDate" timestamp(3) without time zone NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: AcademicYear_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."AcademicYear_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: AcademicYear_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."AcademicYear_id_seq" OWNED BY public."AcademicYear".id;


--
-- Name: ApprovalProcess; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ApprovalProcess" (
    id integer NOT NULL,
    "processName" text NOT NULL,
    description text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: ApprovalProcess_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."ApprovalProcess_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ApprovalProcess_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."ApprovalProcess_id_seq" OWNED BY public."ApprovalProcess".id;


--
-- Name: ApprovalResult; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ApprovalResult" (
    id integer NOT NULL,
    "nominationId" integer NOT NULL,
    "approverId" integer NOT NULL,
    status public."ReviewDecision" NOT NULL,
    comment text,
    "approvalDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ApprovalResult_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."ApprovalResult_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ApprovalResult_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."ApprovalResult_id_seq" OWNED BY public."ApprovalResult".id;


--
-- Name: ApprovalStep; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ApprovalStep" (
    id integer NOT NULL,
    "processId" integer NOT NULL,
    "stepOrder" integer NOT NULL,
    role public."Role" NOT NULL,
    description text
);


--
-- Name: ApprovalStep_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."ApprovalStep_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ApprovalStep_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."ApprovalStep_id_seq" OWNED BY public."ApprovalStep".id;


--
-- Name: AuditLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AuditLog" (
    id integer NOT NULL,
    "userId" integer NOT NULL,
    action text NOT NULL,
    "timestamp" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    description text
);


--
-- Name: AuditLog_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."AuditLog_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: AuditLog_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."AuditLog_id_seq" OWNED BY public."AuditLog".id;


--
-- Name: AwardType; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AwardType" (
    id integer NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    category text NOT NULL,
    description text,
    "periodYear" integer NOT NULL,
    "academicYearId" integer,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: AwardType_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."AwardType_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: AwardType_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."AwardType_id_seq" OWNED BY public."AwardType".id;


--
-- Name: Criteria; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Criteria" (
    id integer NOT NULL,
    code text NOT NULL,
    title text NOT NULL,
    description text,
    "maxPoint" integer NOT NULL,
    "periodYear" integer,
    "academicYearId" integer,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Criteria_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Criteria_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Criteria_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Criteria_id_seq" OWNED BY public."Criteria".id;


--
-- Name: Department; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Department" (
    id integer NOT NULL,
    "departmentName" text NOT NULL,
    "departmentType" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Department_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Department_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Department_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Department_id_seq" OWNED BY public."Department".id;


--
-- Name: Evidence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Evidence" (
    id integer NOT NULL,
    "nominationId" integer NOT NULL,
    "fileUrl" text NOT NULL,
    description text,
    "uploadedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Evidence_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Evidence_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Evidence_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Evidence_id_seq" OWNED BY public."Evidence".id;


--
-- Name: Nomination; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Nomination" (
    id integer NOT NULL,
    title text NOT NULL,
    "periodYear" integer NOT NULL,
    "academicYearId" integer,
    status public."NominationStatus" DEFAULT 'DRAFT'::public."NominationStatus" NOT NULL,
    "totalSelfPoint" integer DEFAULT 0 NOT NULL,
    "applicantId" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: NominationItem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."NominationItem" (
    id integer NOT NULL,
    "nominationId" integer NOT NULL,
    "criteriaId" integer NOT NULL,
    "selfPoint" integer NOT NULL,
    evidence text
);


--
-- Name: NominationItem_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."NominationItem_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: NominationItem_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."NominationItem_id_seq" OWNED BY public."NominationItem".id;


--
-- Name: Nomination_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Nomination_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Nomination_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Nomination_id_seq" OWNED BY public."Nomination".id;


--
-- Name: Notification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Notification" (
    id integer NOT NULL,
    "userId" integer NOT NULL,
    message text NOT NULL,
    status public."NotificationStatus" DEFAULT 'UNREAD'::public."NotificationStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Notification_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Notification_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Notification_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Notification_id_seq" OWNED BY public."Notification".id;


--
-- Name: ReviewStep; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ReviewStep" (
    id integer NOT NULL,
    "nominationId" integer NOT NULL,
    "reviewerId" integer NOT NULL,
    level public."ReviewLevel" NOT NULL,
    decision public."ReviewDecision" DEFAULT 'PENDING'::public."ReviewDecision" NOT NULL,
    comment text,
    "reviewedAt" timestamp(3) without time zone
);


--
-- Name: ReviewStep_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."ReviewStep_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ReviewStep_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."ReviewStep_id_seq" OWNED BY public."ReviewStep".id;


--
-- Name: User; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."User" (
    id integer NOT NULL,
    "fullName" text NOT NULL,
    email text NOT NULL,
    "passwordHash" text NOT NULL,
    role public."Role" NOT NULL,
    department text,
    "departmentId" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: User_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."User_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: User_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."User_id_seq" OWNED BY public."User".id;


--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


--
-- Name: AcademicYear id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AcademicYear" ALTER COLUMN id SET DEFAULT nextval('public."AcademicYear_id_seq"'::regclass);


--
-- Name: ApprovalProcess id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ApprovalProcess" ALTER COLUMN id SET DEFAULT nextval('public."ApprovalProcess_id_seq"'::regclass);


--
-- Name: ApprovalResult id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ApprovalResult" ALTER COLUMN id SET DEFAULT nextval('public."ApprovalResult_id_seq"'::regclass);


--
-- Name: ApprovalStep id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ApprovalStep" ALTER COLUMN id SET DEFAULT nextval('public."ApprovalStep_id_seq"'::regclass);


--
-- Name: AuditLog id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuditLog" ALTER COLUMN id SET DEFAULT nextval('public."AuditLog_id_seq"'::regclass);


--
-- Name: AwardType id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AwardType" ALTER COLUMN id SET DEFAULT nextval('public."AwardType_id_seq"'::regclass);


--
-- Name: Criteria id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Criteria" ALTER COLUMN id SET DEFAULT nextval('public."Criteria_id_seq"'::regclass);


--
-- Name: Department id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Department" ALTER COLUMN id SET DEFAULT nextval('public."Department_id_seq"'::regclass);


--
-- Name: Evidence id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Evidence" ALTER COLUMN id SET DEFAULT nextval('public."Evidence_id_seq"'::regclass);


--
-- Name: Nomination id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Nomination" ALTER COLUMN id SET DEFAULT nextval('public."Nomination_id_seq"'::regclass);


--
-- Name: NominationItem id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."NominationItem" ALTER COLUMN id SET DEFAULT nextval('public."NominationItem_id_seq"'::regclass);


--
-- Name: Notification id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notification" ALTER COLUMN id SET DEFAULT nextval('public."Notification_id_seq"'::regclass);


--
-- Name: ReviewStep id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ReviewStep" ALTER COLUMN id SET DEFAULT nextval('public."ReviewStep_id_seq"'::regclass);


--
-- Name: User id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User" ALTER COLUMN id SET DEFAULT nextval('public."User_id_seq"'::regclass);


--
-- Data for Name: AcademicYear; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."AcademicYear" (id, "yearName", "startDate", "endDate", "isActive", "createdAt") FROM stdin;
1	2025-2026	2025-09-01 00:00:00	2026-07-31 00:00:00	t	2026-05-06 05:33:17.395
3	2026-2027	2026-09-01 00:00:00	2027-07-31 00:00:00	t	2026-05-06 05:51:27.321
4	2026-1778046734175	2026-09-01 00:00:00	2027-07-31 00:00:00	t	2026-05-06 05:52:15.036
\.


--
-- Data for Name: ApprovalProcess; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ApprovalProcess" (id, "processName", description, "createdAt", "updatedAt") FROM stdin;
1	Quy trinh mac dinh	Xet duyet theo cap Khoa -> Truong	2026-05-06 05:33:17.43	2026-05-06 05:33:17.43
2	Smoke Process Updated	Smoke2	2026-05-06 05:51:27.404	2026-05-06 05:51:27.52
3	Smoke Process Updated 1778046734175	Smoke2	2026-05-06 05:52:15.043	2026-05-06 05:52:15.059
\.


--
-- Data for Name: ApprovalResult; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ApprovalResult" (id, "nominationId", "approverId", status, comment, "approvalDate") FROM stdin;
1	1	2	APPROVED	OK	2026-05-06 05:51:28.801
2	1	6	APPROVED	Final OK	2026-05-06 05:51:29.119
3	2	2	APPROVED	OK	2026-05-06 05:52:15.158
4	2	6	APPROVED	Final OK	2026-05-06 05:52:15.189
5	2	1	APPROVED	Final approval	2026-05-06 05:52:47.531
\.


--
-- Data for Name: ApprovalStep; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ApprovalStep" (id, "processId", "stepOrder", role, description) FROM stdin;
1	1	1	CANBO	Duyet cap don vi
2	1	2	CANBO	Duyet cap khoa
3	1	3	HOIDONG	Phe duyet cap truong
6	2	1	CANBO	Step 1
7	2	2	HOIDONG	Step 2
8	2	3	ADMIN	Step 3
11	3	1	CANBO	Step 1
12	3	2	HOIDONG	Step 2
13	3	3	ADMIN	Step 3
\.


--
-- Data for Name: AuditLog; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."AuditLog" (id, "userId", action, "timestamp", description) FROM stdin;
1	1	CREATE_USER	2026-05-06 05:51:26.924	Created user postman.user@iuh.edu.vn
2	4	CREATE_NOMINATION	2026-05-06 05:51:27.877	Created nomination 1
3	4	SUBMIT_NOMINATION	2026-05-06 05:51:27.955	Submitted nomination 1
4	2	REVIEW_DECISION	2026-05-06 05:51:28.805	Decision APPROVED for nomination 1
5	6	REVIEW_DECISION	2026-05-06 05:51:29.121	Decision APPROVED for nomination 1
6	1	DELETE_USER	2026-05-06 05:52:14.887	Deleted user postman.admin.1778046734175@iuh.edu.vn
7	1	CREATE_USER	2026-05-06 05:52:14.975	Created user postman.user.1778046734175@iuh.edu.vn
8	1	UPDATE_USER	2026-05-06 05:52:14.982	Updated user postman.user.1778046734175@iuh.edu.vn
9	1	DELETE_USER	2026-05-06 05:52:14.989	Deleted user postman.user.1778046734175@iuh.edu.vn
10	4	CREATE_NOMINATION	2026-05-06 05:52:15.086	Created nomination 2
11	4	UPDATE_NOMINATION	2026-05-06 05:52:15.101	Updated nomination 2
12	4	SUBMIT_NOMINATION	2026-05-06 05:52:15.125	Submitted nomination 2
13	2	REVIEW_DECISION	2026-05-06 05:52:15.163	Decision APPROVED for nomination 2
14	6	REVIEW_DECISION	2026-05-06 05:52:15.193	Decision APPROVED for nomination 2
15	1	REVIEW_DECISION	2026-05-06 05:52:47.538	Decision APPROVED for nomination 2
\.


--
-- Data for Name: AwardType; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."AwardType" (id, code, name, category, description, "periodYear", "academicYearId", "isActive", "createdAt") FROM stdin;
1	DHTD_LDTT	Lao dong tien tien	Danh hieu thi dua	Danh hieu cho ca nhan hoan thanh tot nhiem vu.	2026	1	t	2026-05-06 05:33:17.419
2	DHTD_CSTD	Chien si thi dua co so	Danh hieu thi dua	Danh hieu cho ca nhan co sang kien va ket qua noi bat.	2026	1	t	2026-05-06 05:33:17.423
3	KT_BGH	Giay khen cap truong	Hinh thuc khen thuong	Khen thuong do Hoi dong thi dua cap truong de xuat.	2026	1	t	2026-05-06 05:33:17.425
7	POSTMAN_AWARD	Postman Award	Danh hieu thi dua	Smoke	2026	\N	t	2026-05-06 05:51:27.172
\.


--
-- Data for Name: Criteria; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Criteria" (id, code, title, description, "maxPoint", "periodYear", "academicYearId", "isActive", "createdAt") FROM stdin;
1	NCKH	Nghien cuu khoa hoc	Bai bao, de tai, sang kien.	40	2026	1	t	2026-05-06 05:33:17.414
2	GIANGDAY	Chat luong giang day	Danh gia hoc phan, doi moi phuong phap.	35	2026	1	t	2026-05-06 05:33:17.417
3	DOAN_THE	Cong tac doan the	Hoat dong cong dong, phong trao.	25	2026	1	t	2026-05-06 05:33:17.418
7	POSTMAN	Postman Test Updated	Smoke test	12	2026	\N	t	2026-05-06 05:51:27.011
\.


--
-- Data for Name: Department; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Department" (id, "departmentName", "departmentType", "createdAt") FROM stdin;
1	Khoa CNTT	KHOA	2026-05-06 05:33:17.365
2	Phong To Chuc	PHONG	2026-05-06 05:33:17.386
3	Phong Cong tac sinh vien	PHONG	2026-05-06 05:33:17.387
7	Phong Test	PHONG	2026-05-06 05:51:27.246
8	Phong Test 1778046734175	PHONG	2026-05-06 05:52:15.03
\.


--
-- Data for Name: Evidence; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Evidence" (id, "nominationId", "fileUrl", description, "uploadedAt") FROM stdin;
\.


--
-- Data for Name: Nomination; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Nomination" (id, title, "periodYear", "academicYearId", status, "totalSelfPoint", "applicantId", "createdAt", "updatedAt") FROM stdin;
1	Postman Nomination	2026	\N	SUBMITTED	9	4	2026-05-06 05:51:27.869	2026-05-06 05:51:27.948
2	Postman Nomination Updated 1778046734175	2026	\N	APPROVED	11	4	2026-05-06 05:52:15.08	2026-05-06 05:52:47.529
\.


--
-- Data for Name: NominationItem; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."NominationItem" (id, "nominationId", "criteriaId", "selfPoint", evidence) FROM stdin;
1	1	1	5	E1
2	1	2	4	E2
5	2	1	6	E1
6	2	2	5	E2
\.


--
-- Data for Name: Notification; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Notification" (id, "userId", message, status, "createdAt") FROM stdin;
1	2	Co ho so moi can duyet: Postman Nomination	UNREAD	2026-05-06 05:51:27.956
2	6	Co ho so can duyet tiep: Postman Nomination	UNREAD	2026-05-06 05:51:28.808
3	1	Co ho so can duyet tiep: Postman Nomination	UNREAD	2026-05-06 05:51:29.122
4	2	Co ho so moi can duyet: Postman Nomination Updated 1778046734175	UNREAD	2026-05-06 05:52:15.126
5	6	Co ho so can duyet tiep: Postman Nomination Updated 1778046734175	UNREAD	2026-05-06 05:52:15.164
6	1	Co ho so can duyet tiep: Postman Nomination Updated 1778046734175	UNREAD	2026-05-06 05:52:15.194
7	4	Ho so Postman Nomination Updated 1778046734175 da duoc cong nhan	UNREAD	2026-05-06 05:52:47.541
\.


--
-- Data for Name: ReviewStep; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ReviewStep" (id, "nominationId", "reviewerId", level, decision, comment, "reviewedAt") FROM stdin;
3	1	1	TRUONG	PENDING	\N	\N
1	1	2	DONVI	APPROVED	OK	2026-05-06 05:51:28.798
2	1	6	KHOA	APPROVED	Final OK	2026-05-06 05:51:29.118
4	2	2	DONVI	APPROVED	OK	2026-05-06 05:52:15.156
5	2	6	KHOA	APPROVED	Final OK	2026-05-06 05:52:15.187
6	2	1	TRUONG	APPROVED	Final approval	2026-05-06 05:52:47.525
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."User" (id, "fullName", email, "passwordHash", role, department, "departmentId", "createdAt") FROM stdin;
1	Quan tri he thong	admin@iuh.edu.vn	$2b$10$46jYHLh4gT8i5OIe5MRSfOwNdz.3LMSieWuZdf17zyVYOYTWqGgkW	ADMIN	Phong To Chuc	2	2026-05-06 05:33:17.399
2	Can bo Don vi	canbo1@iuh.edu.vn	$2b$10$46jYHLh4gT8i5OIe5MRSfOwNdz.3LMSieWuZdf17zyVYOYTWqGgkW	CANBO	Khoa CNTT	1	2026-05-06 05:33:17.406
3	Can bo Khoa	canbo2@iuh.edu.vn	$2b$10$46jYHLh4gT8i5OIe5MRSfOwNdz.3LMSieWuZdf17zyVYOYTWqGgkW	CANBO	Khoa CNTT	1	2026-05-06 05:33:17.408
4	Giang vien Mau	gv@iuh.edu.vn	$2b$10$46jYHLh4gT8i5OIe5MRSfOwNdz.3LMSieWuZdf17zyVYOYTWqGgkW	GIANGVIEN	Khoa CNTT	1	2026-05-06 05:33:17.409
5	Sinh vien Mau	sv@iuh.edu.vn	$2b$10$46jYHLh4gT8i5OIe5MRSfOwNdz.3LMSieWuZdf17zyVYOYTWqGgkW	SINHVIEN	Khoa CNTT	1	2026-05-06 05:33:17.411
6	Hoi dong thi dua cap truong	hoidong@iuh.edu.vn	$2b$10$46jYHLh4gT8i5OIe5MRSfOwNdz.3LMSieWuZdf17zyVYOYTWqGgkW	HOIDONG	Phong Cong tac sinh vien	3	2026-05-06 05:33:17.412
13	xunam	xunam0405@gmail.com	$2b$10$wuqUomF44P64Drw4R9rOzubMGQdJX/HgCkOe/opjuMpB2Aa4xZEIS	SINHVIEN		\N	2026-05-06 05:42:59.91
14	Postman Test User	postman.user@iuh.edu.vn	$2b$10$0/DokgUL8RqZND70leotPu95k8PFgpNbr6a4fXvc7rl7M2URMuUIm	SINHVIEN	Khoa CNTT	\N	2026-05-06 05:51:26.921
17	Logic Test Admin	logic.test.639136437370584749@iuh.edu.vn	$2b$10$Iib0VK4RrGQvs2SAhTmj3e7tS1.qmI8b2kzkfB3X12Lt4FyGP4W32	SINHVIEN	Phong Test	\N	2026-05-06 05:55:37.178
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
39037aa3-11a8-49ba-943b-a09ead44f9a7	142bf269c06c93f918645cc881cad74c39e4f9ac8e476abac4f68205d032f54b	2026-05-06 12:33:10.367601+07	20260503080141_init_postgres	\N	\N	2026-05-06 12:33:10.269493+07	1
\.


--
-- Name: AcademicYear_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."AcademicYear_id_seq"', 4, true);


--
-- Name: ApprovalProcess_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."ApprovalProcess_id_seq"', 3, true);


--
-- Name: ApprovalResult_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."ApprovalResult_id_seq"', 5, true);


--
-- Name: ApprovalStep_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."ApprovalStep_id_seq"', 13, true);


--
-- Name: AuditLog_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."AuditLog_id_seq"', 15, true);


--
-- Name: AwardType_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."AwardType_id_seq"', 8, true);


--
-- Name: Criteria_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Criteria_id_seq"', 8, true);


--
-- Name: Department_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Department_id_seq"', 8, true);


--
-- Name: Evidence_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Evidence_id_seq"', 1, false);


--
-- Name: NominationItem_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."NominationItem_id_seq"', 6, true);


--
-- Name: Nomination_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Nomination_id_seq"', 2, true);


--
-- Name: Notification_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Notification_id_seq"', 7, true);


--
-- Name: ReviewStep_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."ReviewStep_id_seq"', 6, true);


--
-- Name: User_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."User_id_seq"', 17, true);


--
-- Name: AcademicYear AcademicYear_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AcademicYear"
    ADD CONSTRAINT "AcademicYear_pkey" PRIMARY KEY (id);


--
-- Name: ApprovalProcess ApprovalProcess_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ApprovalProcess"
    ADD CONSTRAINT "ApprovalProcess_pkey" PRIMARY KEY (id);


--
-- Name: ApprovalResult ApprovalResult_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ApprovalResult"
    ADD CONSTRAINT "ApprovalResult_pkey" PRIMARY KEY (id);


--
-- Name: ApprovalStep ApprovalStep_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ApprovalStep"
    ADD CONSTRAINT "ApprovalStep_pkey" PRIMARY KEY (id);


--
-- Name: AuditLog AuditLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_pkey" PRIMARY KEY (id);


--
-- Name: AwardType AwardType_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AwardType"
    ADD CONSTRAINT "AwardType_pkey" PRIMARY KEY (id);


--
-- Name: Criteria Criteria_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Criteria"
    ADD CONSTRAINT "Criteria_pkey" PRIMARY KEY (id);


--
-- Name: Department Department_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Department"
    ADD CONSTRAINT "Department_pkey" PRIMARY KEY (id);


--
-- Name: Evidence Evidence_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Evidence"
    ADD CONSTRAINT "Evidence_pkey" PRIMARY KEY (id);


--
-- Name: NominationItem NominationItem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."NominationItem"
    ADD CONSTRAINT "NominationItem_pkey" PRIMARY KEY (id);


--
-- Name: Nomination Nomination_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Nomination"
    ADD CONSTRAINT "Nomination_pkey" PRIMARY KEY (id);


--
-- Name: Notification Notification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_pkey" PRIMARY KEY (id);


--
-- Name: ReviewStep ReviewStep_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ReviewStep"
    ADD CONSTRAINT "ReviewStep_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: AcademicYear_yearName_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "AcademicYear_yearName_key" ON public."AcademicYear" USING btree ("yearName");


--
-- Name: ApprovalStep_processId_stepOrder_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ApprovalStep_processId_stepOrder_key" ON public."ApprovalStep" USING btree ("processId", "stepOrder");


--
-- Name: AwardType_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "AwardType_code_key" ON public."AwardType" USING btree (code);


--
-- Name: Criteria_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Criteria_code_key" ON public."Criteria" USING btree (code);


--
-- Name: Department_departmentName_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Department_departmentName_key" ON public."Department" USING btree ("departmentName");


--
-- Name: NominationItem_nominationId_criteriaId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "NominationItem_nominationId_criteriaId_key" ON public."NominationItem" USING btree ("nominationId", "criteriaId");


--
-- Name: ReviewStep_nominationId_reviewerId_level_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ReviewStep_nominationId_reviewerId_level_key" ON public."ReviewStep" USING btree ("nominationId", "reviewerId", level);


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: ApprovalResult ApprovalResult_approverId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ApprovalResult"
    ADD CONSTRAINT "ApprovalResult_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ApprovalResult ApprovalResult_nominationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ApprovalResult"
    ADD CONSTRAINT "ApprovalResult_nominationId_fkey" FOREIGN KEY ("nominationId") REFERENCES public."Nomination"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ApprovalStep ApprovalStep_processId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ApprovalStep"
    ADD CONSTRAINT "ApprovalStep_processId_fkey" FOREIGN KEY ("processId") REFERENCES public."ApprovalProcess"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AuditLog AuditLog_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AwardType AwardType_academicYearId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AwardType"
    ADD CONSTRAINT "AwardType_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES public."AcademicYear"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Criteria Criteria_academicYearId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Criteria"
    ADD CONSTRAINT "Criteria_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES public."AcademicYear"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Evidence Evidence_nominationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Evidence"
    ADD CONSTRAINT "Evidence_nominationId_fkey" FOREIGN KEY ("nominationId") REFERENCES public."Nomination"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: NominationItem NominationItem_criteriaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."NominationItem"
    ADD CONSTRAINT "NominationItem_criteriaId_fkey" FOREIGN KEY ("criteriaId") REFERENCES public."Criteria"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: NominationItem NominationItem_nominationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."NominationItem"
    ADD CONSTRAINT "NominationItem_nominationId_fkey" FOREIGN KEY ("nominationId") REFERENCES public."Nomination"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Nomination Nomination_academicYearId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Nomination"
    ADD CONSTRAINT "Nomination_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES public."AcademicYear"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Nomination Nomination_applicantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Nomination"
    ADD CONSTRAINT "Nomination_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Notification Notification_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ReviewStep ReviewStep_nominationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ReviewStep"
    ADD CONSTRAINT "ReviewStep_nominationId_fkey" FOREIGN KEY ("nominationId") REFERENCES public."Nomination"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ReviewStep ReviewStep_reviewerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ReviewStep"
    ADD CONSTRAINT "ReviewStep_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: User User_departmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES public."Department"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict 6cLnMK6ief45NiO0upFesyCJd6IjRMQJZW3kIrUUFyZB9d2Q21CpojFtt6AR5fV

