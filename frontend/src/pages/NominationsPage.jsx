import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { downloadEvidence } from "../utils/downloadEvidence";
import "../styles/NominationsPage.css";

const ALLOWED_EVIDENCE_EXTENSIONS = ["pdf", "docx", "xlsx", "png", "jpg", "jpeg", "zip"];
const MEMBER_ROLE_OPTIONS = [
  { value: "STUDENT", label: "Sinh viên" },
  { value: "LECTURER", label: "Giảng viên" },
  { value: "ADVISOR", label: "Người hướng dẫn" },
  { value: "CO_AUTHOR", label: "Đồng tác giả" },
  { value: "LEADER", label: "Trưởng nhóm" },
];
const memberRoleLabels = Object.fromEntries(MEMBER_ROLE_OPTIONS.map((item) => [item.value, item.label]));

function isAllowedEvidenceFile(file) {
  const extension = (file?.name?.split(".").pop() || "").toLowerCase();
  return ALLOWED_EVIDENCE_EXTENSIONS.includes(extension);
}

export default function NominationsPage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [nominations, setNominations] = useState([]);
  const [awards, setAwards] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState({});
  const [selectedFileNames, setSelectedFileNames] = useState({});
  const fileInputRefs = useRef({});
  const [title, setTitle] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [selectedAwardId, setSelectedAwardId] = useState("");
  const [awardEvidenceFiles, setAwardEvidenceFiles] = useState({});
  const [awardEvidenceFileNames, setAwardEvidenceFileNames] = useState({});
  const [awardExistingEvidences, setAwardExistingEvidences] = useState({});
  const [editingNominationId, setEditingNominationId] = useState(null);
  const [submissionType, setSubmissionType] = useState("INDIVIDUAL");
  const [groupName, setGroupName] = useState("");
  const [groupMembers, setGroupMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [decidingReviewId, setDecidingReviewId] = useState(null);
  const [scoreModal, setScoreModal] = useState({ open: false, reviewId: null, nomination: null });
  const [scoreModalScores, setScoreModalScores] = useState({});
  const [scoreModalSubScores, setScoreModalSubScores] = useState({});
  const [scoreModalComment, setScoreModalComment] = useState("");
  const [detailModal, setDetailModal] = useState({ open: false, nomination: null });
  const [detailEvidenceScores, setDetailEvidenceScores] = useState({});
  const [detailReviewComment, setDetailReviewComment] = useState("");
  const [filters, setFilters] = useState({
    keyword: "",
    status: "",
    type: "",
    year: "",
    applicant: "",
    archive: "active",
  });

  const canCreate = ["GIANGVIEN", "SINHVIEN"].includes(user.role);
  const canReview = ["CANBO", "HOIDONG", "ADMIN"].includes(user.role);
  const levelRank = { KHOA: 1, TRUONG: 2 };
  const selectedAward = awards.find((award) => award.id === Number(selectedAwardId));

  const load = async () => {
    try {
      const archiveParam = user.role === "ADMIN"
        ? filters.archive === "archived"
          ? "?archived=only"
          : filters.archive === "all"
            ? "?archived=all"
            : ""
        : "";
      const [nominationRes, awardRes] = await Promise.all([api.get(`/nominations${archiveParam}`), api.get("/awards")]);
      setNominations(nominationRes.data);
      setAwards((awardRes.data || []).filter((award) => award.isActive !== false));
    } catch (err) {
      console.error("Error loading nominations:", err);
    }
  };

  useEffect(() => {
    load();
  }, [filters.archive]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setFilters((prev) => ({
      ...prev,
      status: params.get("status") || "",
      keyword: params.get("title") || "",
    }));
  }, [location.search]);

  const addGroupMember = () => {
    setGroupMembers((prev) => [
      ...prev,
      { fullName: "", email: "", memberRole: "STUDENT", contribution: "", isLeader: false },
    ]);
  };

  const updateGroupMember = (index, field, value) => {
    setGroupMembers((prev) =>
      prev.map((member, currentIndex) => {
        if (currentIndex !== index) return member;
        const next = { ...member, [field]: value };
        if (field === "isLeader" && value) next.memberRole = "LEADER";
        if (field === "memberRole" && value === "LEADER") next.isLeader = true;
        return next;
      })
    );
  };

  const removeGroupMember = (index) => {
    setGroupMembers((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
  };

  const getCleanGroupMembers = () =>
    groupMembers
      .map((member) => ({
        ...member,
        fullName: member.fullName.trim(),
        email: member.email.trim(),
        contribution: member.contribution.trim(),
      }))
      .filter((member) => member.fullName || member.email || member.contribution);

  const resetNominationForm = () => {
    setEditingNominationId(null);
    setTitle("");
    setYear(new Date().getFullYear());
    setSelectedAwardId("");
    setAwardEvidenceFiles({});
    setAwardEvidenceFileNames({});
    setAwardExistingEvidences({});
    setSubmissionType("INDIVIDUAL");
    setGroupName("");
    setGroupMembers([]);
  };

  const handleAwardFileSelect = (awardCriterionId, event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!isAllowedEvidenceFile(file)) {
      alert("Chỉ được tải lên file PDF, DOCX, XLSX, PNG/JPG hoặc ZIP.");
      event.target.value = "";
      return;
    }

    setAwardEvidenceFiles((prev) => ({ ...prev, [awardCriterionId]: file }));
    setAwardEvidenceFileNames((prev) => ({ ...prev, [awardCriterionId]: file.name }));
  };

  const clearAwardFile = (awardCriterionId) => {
    setAwardEvidenceFiles((prev) => ({ ...prev, [awardCriterionId]: null }));
    setAwardEvidenceFileNames((prev) => ({ ...prev, [awardCriterionId]: null }));
  };

  const buildAwardExistingEvidenceMap = (nomination) =>
    Object.fromEntries(
      (nomination.evidences || [])
        .filter((evidence) => evidence.awardCriterionId)
        .map((evidence) => [evidence.awardCriterionId, evidence])
    );

  const startEditDraft = (nomination) => {
    setEditingNominationId(nomination.id);
    setTitle(nomination.title || "");
    setYear(nomination.periodYear || new Date().getFullYear());
    setSelectedAwardId(nomination.awardTypeId ? String(nomination.awardTypeId) : "");
    setSubmissionType(nomination.submissionType || "INDIVIDUAL");
    setGroupName(nomination.groupName || "");
    setGroupMembers(
      (nomination.members || []).map((member) => ({
        fullName: member.fullName || "",
        email: member.email || "",
        memberRole: member.memberRole || "STUDENT",
        contribution: member.contribution || "",
        isLeader: Boolean(member.isLeader),
      }))
    );
    setAwardEvidenceFiles({});
    setAwardEvidenceFileNames({});
    setAwardExistingEvidences(buildAwardExistingEvidenceMap(nomination));

    setTimeout(() => {
      document.querySelector(".nomination-form-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const handleSubmitNomination = async () => {
    if (!title.trim()) {
      alert("Vui lòng nhập tên hồ sơ");
      return;
    }

    if (!selectedAward) {
      alert("Vui lòng chọn danh hiệu/khen thưởng trước khi lưu hồ sơ.");
      return;
    }

    if (!selectedAward.criteria?.length) {
      alert("Danh hiệu đã chọn chưa có tiêu chí xét. Vui lòng cấu hình tiêu chí trước khi tạo hồ sơ.");
      return;
    }

    const cleanGroupMembers = getCleanGroupMembers();
    if (submissionType === "GROUP") {
      if (!groupName.trim()) {
        alert("Vui lòng nhập tên nhóm.");
        return;
      }

      if (!cleanGroupMembers.length) {
        alert("Vui lòng thêm ít nhất một thành viên cho hồ sơ nhóm.");
        return;
      }

      if (cleanGroupMembers.some((member) => !member.fullName || !member.memberRole)) {
        alert("Vui lòng nhập đầy đủ họ tên và vai trò của từng thành viên nhóm.");
        return;
      }
    }

    setLoading(true);
    try {
      const awardCriteriaEvidences = [];

      for (const criterion of selectedAward.criteria || []) {
        const criterionId = criterion.id;
        const file = awardEvidenceFiles[criterionId];
        if (file) {
          const formData = new FormData();
          formData.append("file", file);
          const res = await api.post("/nominations/upload-evidence", formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          awardCriteriaEvidences.push({
            awardCriterionId: criterionId,
            ...res.data,
          });
        } else if (awardExistingEvidences[criterionId]?.fileUrl) {
          const evidence = awardExistingEvidences[criterionId];
          awardCriteriaEvidences.push({
            awardCriterionId: criterionId,
            fileUrl: evidence.fileUrl,
            fileHash: evidence.fileHash || null,
            scanStatus: evidence.scanStatus || "CLEAN",
            scanDetail: evidence.scanDetail || null,
            scannedAt: evidence.scannedAt || null,
          });
        }
      }

      const missingCriteria = (selectedAward.criteria || []).filter(
        (criterion) => !awardCriteriaEvidences.some((evidence) => evidence.awardCriterionId === criterion.id)
      );
      if (missingCriteria.length) {
        alert(`Vui lòng tải lên minh chứng cho tất cả tiêu chí. Còn thiếu: ${missingCriteria.map((item) => item.title).join(", ")}`);
        setLoading(false);
        return;
      }

      const payload = {
        title,
        periodYear: Number(year),
        awardTypeId: Number(selectedAwardId),
        submissionType,
        groupName: submissionType === "GROUP" ? groupName.trim() : "",
        members: submissionType === "GROUP" ? cleanGroupMembers : [],
        items: [],
        awardCriteriaEvidences,
      };

      if (editingNominationId) {
        await api.put(`/nominations/${editingNominationId}`, payload);
      } else {
        await api.post("/nominations", payload);
      }

      alert(editingNominationId ? "Cập nhật hồ sơ thành công!" : "Lưu hồ sơ thành công!");
      resetNominationForm();
      await load();
    } catch (err) {
      console.error("Error creating nomination:", err);
      alert("Lỗi: " + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const submitNomination = async (id) => {
    try {
      await api.post(`/nominations/${id}/submit`);
      await load();
    } catch (err) {
      console.error("Error submitting nomination:", err);
      alert("Lỗi: " + err.message);
    }
  };

  const reopenNomination = async (id) => {
    try {
      await api.post(`/nominations/${id}/reopen`);
      await load();
    } catch (err) {
      console.error("Error reopening nomination:", err);
      alert("Lỗi mở lại hồ sơ: " + (err.response?.data?.message || err.message));
    }
  };

  const archiveNomination = async (id) => {
    const confirmed = window.confirm("Lưu trữ hồ sơ này? Hồ sơ sẽ được ẩn khỏi danh sách mặc định.");
    if (!confirmed) return;

    try {
      await api.patch(`/nominations/${id}/archive`);
      await load();
    } catch (err) {
      alert("Không lưu trữ được hồ sơ: " + (err.response?.data?.message || err.message));
    }
  };

  const softDeleteRejectedNomination = async (id) => {
    const confirmed = window.confirm("Xóa hồ sơ bị từ chối này khỏi danh sách? Hồ sơ vẫn được lưu trong cơ sở dữ liệu và có thể xem ở mục Đã lưu trữ.");
    if (!confirmed) return;

    try {
      await api.patch(`/nominations/${id}/soft-delete-rejected`);
      await load();
      alert("Đã xóa mềm hồ sơ bị từ chối.");
    } catch (err) {
      alert("Không xóa được hồ sơ: " + (err.response?.data?.message || err.message));
    }
  };

  const restoreNomination = async (id) => {
    try {
      await api.patch(`/nominations/${id}/restore`);
      await load();
    } catch (err) {
      alert("Không khôi phục được hồ sơ: " + (err.response?.data?.message || err.message));
    }
  };

  const canReviewStepNow = (nomination, step) => {
    const priorSteps = (nomination.reviews || []).filter(
      (r) => (levelRank[r.level] || 0) < (levelRank[step.level] || 0)
    );
    return priorSteps.every((r) => r.decision === "APPROVED");
  };

  const reviewFromList = async (reviewId, decision, comment = "", scorePayload = null) => {
    try {
      setDecidingReviewId(reviewId);
      await api.post(`/reviews/${reviewId}/decision`, {
        decision,
        comment,
        ...(scorePayload || {}),
      });
      await load();
    } catch (err) {
      console.error("Error making decision:", err);
      const message = err.response?.data?.message || err.message;
      const failedConditions = err.response?.data?.conditions;

      if (Array.isArray(failedConditions) && failedConditions.length) {
        const conditionText = failedConditions
          .map((condition, index) => {
            const detailText = condition.detail?.length ? ` (${condition.detail.join(", ")})` : "";
            return `${index + 1}. ${condition.label}${detailText}`;
          })
          .join("\n");
        alert(`Lỗi duyệt hồ sơ: ${message}\n\nĐiều kiện chưa đạt:\n${conditionText}`);
      } else {
        alert("Lỗi duyệt hồ sơ: " + message);
      }
    } finally {
      setDecidingReviewId(null);
    }
  };

  const rejectReviewFromList = async (reviewId) => {
    const reason = window.prompt("Nhập lý do từ chối hồ sơ:");
    if (reason === null) return;
    if (!reason.trim()) {
      alert("Vui lòng nhập lý do trước khi từ chối hồ sơ.");
      return;
    }
    await reviewFromList(reviewId, "REJECTED", reason.trim());
  };

  const openScoreModal = (reviewId, nomination) => {
    const initialScores = {};
    const initialSubScores = {};
    (nomination.items || []).forEach((item) => {
      initialScores[item.id] = "";
      (item.criteria?.subItems || []).forEach((subItem) => {
        initialSubScores[`${item.id}_${subItem.id}`] = "";
      });
    });
    setScoreModalScores(initialScores);
    setScoreModalSubScores(initialSubScores);
    setScoreModalComment("");
    setScoreModal({ open: true, reviewId, nomination });
  };

  const closeScoreModal = () => {
    setScoreModal({ open: false, reviewId: null, nomination: null });
    setScoreModalScores({});
    setScoreModalSubScores({});
    setScoreModalComment("");
  };

  const openDetailModal = (nomination) => {
    const initialScores = {};
    buildEvidenceEntries(nomination).forEach((entry) => {
      if (entry.id) initialScores[entry.id] = entry.reviewPoint ?? "";
    });
    setDetailEvidenceScores(initialScores);
    setDetailReviewComment("");
    setDetailModal({ open: true, nomination });
  };

  const closeDetailModal = () => {
    setDetailModal({ open: false, nomination: null });
    setDetailEvidenceScores({});
    setDetailReviewComment("");
  };

  const confirmScoreModal = async () => {
    const nomination = scoreModal.nomination;
    if (!nomination) return;

    for (const item of nomination.items || []) {
      const score = scoreModalScores[item.id];
      if (score === "" || score === undefined || score === null) {
        alert("Vui lòng nhập điểm cho tất cả tiêu chí.");
        return;
      }
      const max = item.criteria?.maxPoint || 0;
      if (Number(score) < 0 || Number(score) > max) {
        alert(`Điểm không hợp lệ cho tiêu chí ${item.criteria?.code || item.id}.`);
        return;
      }
    }

    const scoresPayload = Object.keys(scoreModalScores).map((key) => ({
      nominationItemId: Number(key),
      score: Number(scoreModalScores[key]),
    }));

    await reviewFromList(scoreModal.reviewId, "APPROVED", scoreModalComment, scoresPayload);
    closeScoreModal();
  };

  const handleFileSelect = (nominationId, event) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!isAllowedEvidenceFile(file)) {
        alert("Chỉ được tải lên file PDF, DOCX, XLSX, PNG/JPG hoặc ZIP.");
        event.target.value = "";
        return;
      }

      setSelectedFiles((prev) => ({ ...prev, [nominationId]: file }));
      setSelectedFileNames((prev) => ({ ...prev, [nominationId]: file.name }));
    }
  };

  const handleFileButtonClick = (nominationId) => {
    fileInputRefs.current[nominationId]?.click();
  };

  const uploadEvidence = async (nominationId) => {
    const file = selectedFiles[nominationId];
    if (!file) {
      alert("Vui lòng chọn file trước khi tải lên");
      return;
    }
    try {
      const formData = new FormData();
      formData.append("file", file);
      await api.post(`/nominations/${nominationId}/evidences`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      alert("Tải file thành công!");
      setSelectedFiles((prev) => ({ ...prev, [nominationId]: null }));
      setSelectedFileNames((prev) => ({ ...prev, [nominationId]: null }));
      await load();
    } catch (err) {
      console.error("Error uploading evidence:", err);
      alert("Lỗi tải file: " + (err.response?.data?.message || err.message));
    }
  };

  const handleClearFile = (nominationId) => {
    setSelectedFiles((prev) => ({ ...prev, [nominationId]: null }));
    setSelectedFileNames((prev) => ({ ...prev, [nominationId]: null }));
    if (fileInputRefs.current[nominationId]) {
      fileInputRefs.current[nominationId].value = "";
    }
  };
  const reviewerVisibleStatuses = ["SUBMITTED", "REJECTED", "APPROVED"];

  const statusLabel = (s) => {
    switch (s) {
      case "DRAFT":
        return "Nháp";
      case "SUBMITTED":
        return "Chờ duyệt";
      case "APPROVED":
        return "Đã duyệt";
      case "REJECTED":
        return "Từ chối";
      default:
        return s || "Chưa rõ";
    }
  };

  const getRejectedReason = (nomination) => {
    const rejectedReview = [...(nomination.reviews || [])]
      .reverse()
      .find((review) => review.decision === "REJECTED");
    return rejectedReview?.comment?.trim() || "";
  };

  const getLatestReviewComment = (nomination) => {
    const reviewWithComment = [...(nomination.reviews || [])]
      .reverse()
      .find((review) => review.comment && review.comment.trim());
    return reviewWithComment?.comment?.trim() || "";
  };

  const buildEvidenceEntries = (nomination) => {
    const fromEvidenceTable = (nomination.evidences || [])
      .filter((ev) => ev.fileUrl)
      .map((ev) => ({
        id: ev.id,
        url: ev.fileUrl,
        awardCriterionId: ev.awardCriterionId,
        label: ev.awardCriterion?.title,
        reviewPoint: ev.reviewPoint,
      }));

    const fromItems = (nomination.items || [])
      .map((item) => item.evidence)
      .filter(Boolean)
      .map((url) => ({
        id: null,
        url,
      }));

    const map = new Map();
    [...fromEvidenceTable, ...fromItems].forEach((entry) => {
      if (!map.has(entry.url)) {
        map.set(entry.url, entry);
      }
    });

    return [...map.values()];
  };

  const getMyPendingReviewStep = (nomination) => {
    return (nomination.reviews || []).find((review) => review.reviewerId === user.id && review.decision === "PENDING");
  };

  const isCanbo1KhoaStep = (nomination) => {
    const step = getMyPendingReviewStep(nomination);
    return user.email === "canbo1@iuh.edu.vn" && step?.level === "KHOA" && canReviewStepNow(nomination, step);
  };

  const getDetailEvidenceScoreValue = (entry) => {
    return detailEvidenceScores[entry.id] ?? entry.reviewPoint ?? "";
  };

  const getDetailEvidenceScoreTotal = (entries) => {
    return entries.reduce((sum, entry) => {
      const score = getDetailEvidenceScoreValue(entry);
      return sum + (score === "" || score === null || score === undefined ? 0 : Number(score));
    }, 0);
  };

  const updateDetailEvidenceScore = (evidenceId, value) => {
    setDetailEvidenceScores((prev) => ({ ...prev, [evidenceId]: value }));
  };

  const approveDetailKhoaReview = async (nomination, evidenceEntries) => {
    const step = getMyPendingReviewStep(nomination);
    if (!step || step.level !== "KHOA") {
      alert("Không tìm thấy phiên duyệt cấp khoa của tài khoản hiện tại.");
      return;
    }

    if (!evidenceEntries.length || evidenceEntries.some((entry) => !entry.id)) {
      alert("Hồ sơ chưa có đủ file minh chứng để chấm điểm.");
      return;
    }

    const missingScore = evidenceEntries.some((entry) => {
      const score = getDetailEvidenceScoreValue(entry);
      return score === "" || score === null || score === undefined || Number(score) < 0;
    });

    if (missingScore) {
      alert("Vui lòng nhập điểm hợp lệ cho tất cả file minh chứng.");
      return;
    }

    await reviewFromList(step.id, "APPROVED", detailReviewComment, {
      evidenceScores: evidenceEntries.map((entry) => ({
        evidenceId: entry.id,
        score: Number(getDetailEvidenceScoreValue(entry)),
      })),
    });
    closeDetailModal();
  };

  const rejectDetailKhoaReview = async (nomination) => {
    const step = getMyPendingReviewStep(nomination);
    if (!step || step.level !== "KHOA") {
      alert("Không tìm thấy phiên duyệt cấp khoa của tài khoản hiện tại.");
      return;
    }
    if (!detailReviewComment.trim()) {
      alert("Vui lòng nhập lý do trước khi từ chối hồ sơ.");
      return;
    }
    await reviewFromList(step.id, "REJECTED", detailReviewComment.trim());
    closeDetailModal();
  };

  const deleteEvidence = async (nominationId, evidenceId) => {
    if (!evidenceId) {
      alert("Không thể xóa minh chứng này.");
      return;
    }

    if (!window.confirm("Bạn có chắc muốn xóa tệp minh chứng này không?")) {
      return;
    }

    try {
      await api.delete(`/nominations/${nominationId}/evidences/${evidenceId}`);
      await load();
    } catch (err) {
      console.error("Error deleting evidence:", err);
      alert("Lỗi xóa tệp: " + (err.response?.data?.message || err.message));
    }
  };

  const openEvidence = async (entry, fallbackName = "minh-chung") => {
    try {
      await downloadEvidence(entry?.id, fallbackName);
    } catch (err) {
      alert("Không tải được file minh chứng: " + (err.response?.data?.message || err.message));
    }
  };

  const reviewLevelLabel = {
    KHOA: "Khoa",
    TRUONG: "Trường",
  };

  const reviewDecisionLabel = (decision) => {
    switch (decision) {
      case "APPROVED":
        return "Đã duyệt";
      case "REJECTED":
        return "Từ chối";
      case "PENDING":
        return "Chờ xử lý";
      default:
        return decision || "Chưa rõ";
    }
  };

  const formatDateTime = (value) => {
    if (!value) return "-";
    return new Date(value).toLocaleString("vi-VN");
  };

  const renderReviewTimeline = (nomination) => {
    const reviewsByLevel = Object.fromEntries((nomination.reviews || []).map((review) => [review.level, review]));
    const steps = [
      {
        key: "SUBMITTED",
        label: "Đã nộp",
        state: nomination.status === "DRAFT" ? "pending" : "done",
      },
      ...["KHOA", "TRUONG"].map((level) => {
        const review = reviewsByLevel[level];
        let state = "pending";
        if (review?.decision === "APPROVED") state = "done";
        if (review?.decision === "REJECTED" || nomination.status === "REJECTED") state = "rejected";
        return {
          key: level,
          label: reviewLevelLabel[level],
          state,
          reviewer: review?.reviewer?.fullName,
        };
      }),
      {
        key: "RESULT",
        label: "Kết quả",
        state:
          nomination.status === "APPROVED"
            ? "done"
            : nomination.status === "REJECTED"
              ? "rejected"
              : "pending",
      },
    ];

    return (
      <div className="review-timeline" aria-label="Tiến trình xét duyệt">
        {steps.map((step) => (
          <div key={step.key} className={`timeline-step ${step.state}`}>
            <span className="timeline-dot" />
            <span className="timeline-label">{step.label}</span>
            {step.reviewer ? <small>{step.reviewer}</small> : null}
          </div>
        ))}
      </div>
    );
  };

  const updateFilter = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const clearFilters = () => {
    setFilters({
      keyword: "",
      status: "",
      type: "",
      year: "",
      applicant: "",
      archive: "active",
    });
  };

  const availableYears = [...new Set(nominations.map((nom) => nom.periodYear).filter(Boolean))]
    .sort((a, b) => Number(b) - Number(a));

  const normalizedKeywordFilter = filters.keyword.trim().toLowerCase();
  const normalizedApplicantFilter = filters.applicant.trim().toLowerCase();
  const activeFilterCount = [
    filters.keyword,
    filters.status,
    filters.type,
    filters.year,
    filters.applicant,
    filters.archive !== "active" ? filters.archive : "",
  ].filter((value) => String(value || "").trim()).length;

  const visibleNominations = nominations.filter((nom) => {
    if (filters.status && nom.status !== filters.status) {
      return false;
    }

    if (filters.type && nom.submissionType !== filters.type) {
      return false;
    }

    if (filters.year && String(nom.periodYear || "") !== filters.year) {
      return false;
    }

    if (normalizedKeywordFilter) {
      const searchableText = [
        nom.title,
        nom.awardType?.name,
        nom.awardType?.category,
        nom.groupName,
        nom.applicant?.fullName,
        nom.applicant?.email,
        ...(nom.members || []).map((member) => member.fullName),
        ...(nom.members || []).map((member) => member.email),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!searchableText.includes(normalizedKeywordFilter)) {
        return false;
      }
    }

    if (normalizedApplicantFilter) {
      const applicantText = [nom.applicant?.fullName, nom.applicant?.email]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!applicantText.includes(normalizedApplicantFilter)) {
        return false;
      }
    }

    if (canReview && !canCreate && !reviewerVisibleStatuses.includes(nom.status)) {
      return false;
    }

    return true;
  });

  // Keep the current order for all items, only move SUBMITTED to the front.
  const visibleNominationsSorted = [
    ...visibleNominations.filter((nom) => nom.status === "SUBMITTED"),
    ...visibleNominations.filter((nom) => nom.status !== "SUBMITTED"),
  ];

  return (
    <div className="page-grid">
      {canCreate ? (
        <form className="card form-card nomination-form-card" onSubmit={(e) => { e.preventDefault(); handleSubmitNomination(); }}>
          <h2>{editingNominationId ? "Chỉnh sửa hồ sơ nháp" : "Tạo hồ sơ thi đua"}</h2>

          <div className="form-group-section">
            <div className="form-group">
              <label>Tên hồ sơ <span className="required">*</span></label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Nhập tên hồ sơ"
                maxLength="150"
                required
              />
            </div>

            <div className="form-group">
              <label>Năm <span className="required">*</span></label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                min="2020"
                required
              />
            </div>
          </div>

          <div className="award-selection-panel">
            <div className="form-group">
              <label>Danh hiệu/Khen thưởng đăng ký <span className="required">*</span></label>
              <select
                value={selectedAwardId}
                onChange={(e) => {
                  setSelectedAwardId(e.target.value);
                  setAwardEvidenceFiles({});
                  setAwardEvidenceFileNames({});
                  setAwardExistingEvidences({});
                }}
                required
              >
                <option value="">Chọn danh hiệu hoặc hình thức khen thưởng</option>
                {awards.map((award) => (
                  <option key={award.id} value={award.id}>
                    {award.name} - {award.category} ({award.periodYear})
                  </option>
                ))}
              </select>
              <small>Chọn danh hiệu trước, hệ thống sẽ hiển thị các tiêu chí cần nộp minh chứng.</small>
            </div>

            {selectedAward ? (
              <div className="award-criteria-evidence">
                <div className="award-selected-summary">
                  <strong>{selectedAward.name}</strong>
                  <span>{selectedAward.description || "Chưa có mô tả."}</span>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>Tiêu chí xét</th>
                      <th>Điểm tối thiểu</th>
                      <th>Minh chứng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedAward.criteria || []).length ? selectedAward.criteria.map((criterion) => (
                      <tr key={criterion.id}>
                        <td>
                          <strong>{criterion.title}</strong>
                          {criterion.description ? <small>{criterion.description}</small> : null}
                        </td>
                        <td>{criterion.minPoint ?? "-"}</td>
                        <td>
                          <div className="award-evidence-upload">
                            <input
                              type="file"
                              accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg,.zip"
                              onChange={(e) => handleAwardFileSelect(criterion.id, e)}
                            />
                            {awardEvidenceFileNames[criterion.id] ? (
                              <div className="award-file-pill">
                                <span>{awardEvidenceFileNames[criterion.id]}</span>
                                <button type="button" onClick={() => clearAwardFile(criterion.id)}>×</button>
                              </div>
                            ) : awardExistingEvidences[criterion.id]?.fileUrl ? (
                              <div className="award-file-pill existing">
                                <span>Đã có minh chứng</span>
                              </div>
                            ) : (
                              <small>Chưa chọn file</small>
                            )}
                          </div>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan="3">Danh hiệu này chưa có tiêu chí xét.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>

          <div className="group-nomination-section">
            <div className="form-group">
              <label>Loại hồ sơ <span className="required">*</span></label>
              <div className="submission-type-toggle">
                <button
                  type="button"
                  className={submissionType === "INDIVIDUAL" ? "active" : ""}
                  onClick={() => setSubmissionType("INDIVIDUAL")}
                >
                  Cá nhân
                </button>
                <button
                  type="button"
                  className={submissionType === "GROUP" ? "active" : ""}
                  onClick={() => {
                    setSubmissionType("GROUP");
                    if (!groupMembers.length) addGroupMember();
                  }}
                >
                  Nhóm
                </button>
              </div>
            </div>

            {submissionType === "GROUP" ? (
              <div className="group-members-panel">
                <div className="form-group">
                  <label>Tên nhóm <span className="required">*</span></label>
                  <input
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="Ví dụ: Nhóm nghiên cứu khoa học AI"
                    maxLength="150"
                  />
                  <small>Người tạo hồ sơ sẽ được ghi nhận là trưởng nhóm.</small>
                </div>

                <div className="group-member-header">
                  <strong>Thành viên nhóm</strong>
                  <button type="button" className="btn-add-member" onClick={addGroupMember}>
                    Thêm thành viên
                  </button>
                </div>

                <div className="group-member-list">
                  {groupMembers.map((member, index) => (
                    <div className="group-member-row" key={`member-${index}`}>
                      <input
                        type="text"
                        value={member.fullName}
                        onChange={(e) => updateGroupMember(index, "fullName", e.target.value)}
                        placeholder="Họ và tên"
                      />
                      <input
                        type="email"
                        value={member.email}
                        onChange={(e) => updateGroupMember(index, "email", e.target.value)}
                        placeholder="Email hoặc tài khoản"
                      />
                      <select
                        value={member.memberRole}
                        onChange={(e) => updateGroupMember(index, "memberRole", e.target.value)}
                      >
                        {MEMBER_ROLE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={member.contribution}
                        onChange={(e) => updateGroupMember(index, "contribution", e.target.value)}
                        placeholder="Mô tả đóng góp"
                      />
                      <label className="leader-check">
                        <input
                          type="checkbox"
                          checked={member.isLeader}
                          onChange={(e) => updateGroupMember(index, "isLeader", e.target.checked)}
                        />
                        Trưởng nhóm
                      </label>
                      <button type="button" className="btn-remove-member" onClick={() => removeGroupMember(index)}>
                        Xóa
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="form-actions-bottom">
            <button type="submit" disabled={loading || !selectedAwardId} className="btn-primary">
              {loading ? "Đang lưu..." : editingNominationId ? "Lưu thay đổi" : "Lưu hồ sơ"}
            </button>
            {editingNominationId ? (
              <button type="button" className="btn-cancel" onClick={resetNominationForm}>
                Hủy chỉnh sửa
              </button>
            ) : null}
          </div>
        </form>
      ) : null}

      <div className="card">
        <div className="nomination-list-header">
          <div>
            <h2>Danh sách hồ sơ</h2>
            <p><small>Định dạng minh chứng cho phép: PDF, DOCX, XLSX, PNG, JPG, JPEG, ZIP.</small></p>
          </div>
          <div className="filter-summary">
            <strong>{visibleNominationsSorted.length}</strong>
            <span>/ {nominations.length} hồ sơ</span>
          </div>
        </div>

        <div className="nomination-filters" aria-label="Bộ lọc danh sách hồ sơ">
          <div className="filter-field filter-field-wide">
            <label>Tìm kiếm</label>
            <input
              type="search"
              value={filters.keyword}
              onChange={(e) => updateFilter("keyword", e.target.value)}
              placeholder="Tên hồ sơ, tên nhóm, thành viên..."
            />
          </div>

          <div className="filter-field">
            <label>Trạng thái</label>
            <select value={filters.status} onChange={(e) => updateFilter("status", e.target.value)}>
              <option value="">Tất cả</option>
              <option value="DRAFT">Nháp</option>
              <option value="SUBMITTED">Chờ duyệt</option>
              <option value="APPROVED">Đã duyệt</option>
              <option value="REJECTED">Từ chối</option>
            </select>
          </div>

          <div className="filter-field">
            <label>Loại hồ sơ</label>
            <select value={filters.type} onChange={(e) => updateFilter("type", e.target.value)}>
              <option value="">Tất cả</option>
              <option value="INDIVIDUAL">Cá nhân</option>
              <option value="GROUP">Nhóm</option>
            </select>
          </div>

          <div className="filter-field">
            <label>Năm</label>
            <select value={filters.year} onChange={(e) => updateFilter("year", e.target.value)}>
              <option value="">Tất cả</option>
              {availableYears.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-field">
            <label>Người nộp</label>
            <input
              type="search"
              value={filters.applicant}
              onChange={(e) => updateFilter("applicant", e.target.value)}
              placeholder="Nhập tên hoặc email"
            />
          </div>

          {user.role === "ADMIN" ? (
            <div className="filter-field">
              <label>Lưu trữ</label>
              <select value={filters.archive} onChange={(e) => updateFilter("archive", e.target.value)}>
                <option value="active">Đang hiển thị</option>
                <option value="archived">Đã lưu trữ</option>
                <option value="all">Tất cả</option>
              </select>
            </div>
          ) : null}

          <button type="button" className="btn-clear-filters" onClick={clearFilters} disabled={!activeFilterCount}>
            Xóa lọc{activeFilterCount ? ` (${activeFilterCount})` : ""}
          </button>
        </div>

        <table>
          <thead>
            <tr>
              <th>Tiêu đề</th>
              <th>Danh hiệu/Khen thưởng</th>
              <th>Năm</th>
              <th>Người nộp</th>
              <th>Loại hồ sơ</th>
              <th>Tổng điểm</th>
              <th>Trạng thái</th>
              <th>Tiến trình</th>
              <th>Minh chứng</th>
              <th>Nhận xét</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {visibleNominationsSorted.length ? visibleNominationsSorted.map((nom) => (
              <tr key={nom.id}>
                <td>{nom.title}</td>
                <td>
                  <div className="nomination-award-cell">
                    <strong>{nom.awardType?.name || "-"}</strong>
                    {nom.awardType?.category ? <small>{nom.awardType.category}</small> : null}
                  </div>
                </td>
                <td>{nom.periodYear}</td>
                <td>{nom.applicant?.fullName || "N/A"}</td>
                <td>
                  <div className="nomination-type-cell">
                    <strong>{nom.submissionType === "GROUP" ? "Hồ sơ nhóm" : "Cá nhân"}</strong>
                    {nom.submissionType === "GROUP" ? (
                      <>
                        {nom.groupName ? <small>{nom.groupName}</small> : null}
                        {(nom.members || []).length ? (
                          <div className="member-chip-list">
                            {(nom.members || []).slice(0, 4).map((member) => (
                              <span className={member.isLeader ? "member-chip leader" : "member-chip"} key={member.id}>
                                {member.fullName}
                                <em>{memberRoleLabels[member.memberRole] || member.memberRole}</em>
                              </span>
                            ))}
                            {(nom.members || []).length > 4 ? (
                              <span className="member-chip">+{nom.members.length - 4}</span>
                            ) : null}
                          </div>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </td>
                <td>{nom.totalSelfPoint}</td>
                <td>
                  <div className={`status-cell status-${nom.status.toLowerCase()}`}>
                    <span>{statusLabel(nom.status)}</span>
                    {nom.isArchived ? (
                      <small className="archived-reason">
                        Đã lưu trữ{nom.archivedAt ? ` lúc ${formatDateTime(nom.archivedAt)}` : ""}
                      </small>
                    ) : null}
                    {nom.status === "REJECTED" && getRejectedReason(nom) ? (
                      <small className="rejected-reason">Lý do: {getRejectedReason(nom)}</small>
                    ) : null}
                  </div>
                </td>
                <td>{renderReviewTimeline(nom)}</td>
                <td>
                  <div className="evidence-cell">
                    {buildEvidenceEntries(nom).length ? (
                      <div className="evidence-list">
                        {buildEvidenceEntries(nom).slice(0, 3).map((entry, idx) => (
                          <div key={`${nom.id}-ev-${idx}`} className="evidence-item">
                            <button
                              type="button"
                              className="evidence-link-button"
                              onClick={() => openEvidence(entry, `minh-chung-${idx + 1}`)}
                            >
                              📄 Tệp minh chứng #{idx + 1}
                            </button>
                            {canCreate && nom.applicantId === user.id && nom.status !== "APPROVED" && entry.id ? (
                              <button
                                type="button"
                                className="btn-delete-evidence"
                                title="Xóa tệp minh chứng"
                                onClick={() => deleteEvidence(nom.id, entry.id)}
                              >
                                ✕
                              </button>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="no-evidence">Chưa có</span>
                    )}
                    {canCreate && nom.applicantId === user.id && nom.status !== "APPROVED" ? (
                      <div className="evidence-upload-small">
                        <input
                          ref={(el) => (fileInputRefs.current[nom.id] = el)}
                          type="file"
                          onChange={(e) => handleFileSelect(nom.id, e)}
                          className="file-input-small"
                          accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg,.zip"
                        />
                        <button 
                          type="button"
                          onClick={() => handleFileButtonClick(nom.id)}
                          className="btn-upload-small"
                        >
                          📎 Chọn file
                        </button>
                        {selectedFileNames[nom.id] && (
                          <div className="file-name-small-display">
                            <span>{selectedFileNames[nom.id]}</span>
                            <button
                              type="button"
                              onClick={() => handleClearFile(nom.id)}
                              className="btn-clear-file"
                              title="Xóa file"
                            >
                              ✕
                            </button>
                          </div>
                        )}
                        {selectedFiles[nom.id] && (
                          <button 
                            type="button"
                            onClick={() => uploadEvidence(nom.id)}
                            className="btn-upload-confirm"
                          >
                            ⬆️ Tải lên
                          </button>
                        )}
                      </div>
                    ) : null}
                  </div>
                </td>
                <td>{getLatestReviewComment(nom) || "-"}</td>
                <td className="nomination-actions-cell">
                  {!(canReview
                    && nom.status === "SUBMITTED"
                    && user.email === "canbo1@iuh.edu.vn"
                    && (nom.reviews || []).some(
                      (r) => r.reviewerId === user.id && r.decision === "PENDING" && r.level === "KHOA"
                    )) ? (
                    <button
                      type="button"
                      onClick={() => openDetailModal(nom)}
                      className="btn-detail-small"
                    >
                      Chi tiết
                    </button>
                  ) : null}

                  {user.role === "ADMIN" && ["APPROVED", "REJECTED"].includes(nom.status) ? (
                    nom.isArchived ? (
                      <button
                        type="button"
                        onClick={() => restoreNomination(nom.id)}
                        className="btn-detail-small"
                      >
                        Khôi phục
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => nom.status === "REJECTED" ? softDeleteRejectedNomination(nom.id) : archiveNomination(nom.id)}
                        className={nom.status === "REJECTED" ? "btn-detail-small danger" : "btn-detail-small"}
                      >
                        {nom.status === "REJECTED" ? "X\u00f3a" : "L\u01b0u tr\u1eef"}
                      </button>
                    )
                  ) : null}

                  {canCreate && nom.applicantId === user.id && nom.status === "DRAFT" ? (
                    <>
                    <button
                      type="button"
                      onClick={() => startEditDraft(nom)}
                      className="btn-detail-small"
                    >
                      Sửa
                    </button>
                    <button
                      type="button"
                      onClick={() => submitNomination(nom.id)}
                      className="btn-submit-small"
                    >
                      Nộp duyệt
                    </button>
                    </>
                  ) : null}

                  {canCreate && nom.applicantId === user.id && nom.status === "REJECTED" ? (
                    <button
                      type="button"
                      onClick={() => reopenNomination(nom.id)}
                      className="btn-upload-confirm"
                    >
                      Mở lại hồ sơ
                    </button>
                  ) : null}

                  {canCreate && nom.applicantId === user.id && nom.status === "SUBMITTED" ? (
                    <button type="button" className="btn-submit-small" disabled>
                      Đã nộp duyệt
                    </button>
                  ) : null}

                  {canReview && nom.status === "SUBMITTED" ? (() => {
                    const myPendingStep = (nom.reviews || []).find(
                      (r) => r.reviewerId === user.id && r.decision === "PENDING"
                    );

                    if (!myPendingStep) {
                      return null;
                    }

                    const unlocked = canReviewStepNow(nom, myPendingStep);

                    return (
                      <div className="review-actions-inline">
                        {user.role === "HOIDONG" && myPendingStep.level === "TRUONG" ? (
                          <button
                            type="button"
                            className="btn-submit-small"
                            disabled={!unlocked || decidingReviewId === myPendingStep.id}
                            onClick={() => {
                              navigate(`/reviews?nominationId=${nom.id}&reviewId=${myPendingStep.id}`);
                            }}
                          >
                            {decidingReviewId === myPendingStep.id ? "\u0110ang x\u1eed l\u00fd..." : "X\u00e9t duy\u1ec7t"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn-submit-small"
                            disabled={!unlocked || decidingReviewId === myPendingStep.id}
                            onClick={() => {
                              if (user.email === "canbo1@iuh.edu.vn" && myPendingStep.level === "KHOA") {
                                openDetailModal(nom);
                                return;
                              }
                              reviewFromList(myPendingStep.id, "APPROVED");
                            }}
                          >
                            {decidingReviewId === myPendingStep.id
                              ? "Đang xử lý..."
                              : user.email === "canbo1@iuh.edu.vn" && myPendingStep.level === "KHOA"
                                ? "Chi tiết & chấm điểm"
                                : "Duyệt"}
                          </button>
                        )}
                        {user.role === "CANBO" && myPendingStep.level === "KHOA" ? (
                          <button
                            type="button"
                            className="btn-detail-small danger"
                            disabled={!unlocked || decidingReviewId === myPendingStep.id}
                            onClick={() => rejectReviewFromList(myPendingStep.id)}
                          >
                            {decidingReviewId === myPendingStep.id ? "Đang xử lý..." : "Từ chối"}
                          </button>
                        ) : null}
                        {!unlocked ? <small>Chờ cấp trước duyệt</small> : null}
                      </div>
                    );
                  })() : null}

                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="11">
                  <div className="empty-filter-state">
                    Không có hồ sơ phù hợp với bộ lọc hiện tại.
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {detailModal.open && detailModal.nomination ? createPortal((() => {
        const nomination = detailModal.nomination;
        const evidenceEntries = buildEvidenceEntries(nomination);
        const canScoreEvidenceInDetail = isCanbo1KhoaStep(nomination);

        return (
          <div className="modal-overlay">
            <div className="modal detail-modal" role="dialog" aria-modal="true">
              <div className="modal-header">
                <div>
                  <h3>Chi tiết hồ sơ</h3>
                  <p>{nomination.title}</p>
                </div>
                <button type="button" className="modal-close" onClick={closeDetailModal} aria-label="Đóng">
                  ×
                </button>
              </div>

              <div className="detail-summary-grid">
                <div>
                  <span>Trạng thái</span>
                  <strong>{statusLabel(nomination.status)}</strong>
                </div>
                <div>
                  <span>Năm xét</span>
                  <strong>{nomination.periodYear || "-"}</strong>
                </div>
                <div>
                  <span>Tổng điểm</span>
                  <strong>{nomination.totalSelfPoint ?? 0}</strong>
                </div>
                <div>
                  <span>Loại hồ sơ</span>
                  <strong>{nomination.submissionType === "GROUP" ? "Hồ sơ nhóm" : "Cá nhân"}</strong>
                </div>
              </div>

              <div className="detail-section">
                <h4>Thông tin chung</h4>
                <div className="detail-info-grid">
                  <div>
                    <span>Người nộp</span>
                    <strong>{nomination.applicant?.fullName || "N/A"}</strong>
                  </div>
                  <div>
                    <span>Email</span>
                    <strong>{nomination.applicant?.email || "-"}</strong>
                  </div>
                  <div>
                    <span>Ngày tạo</span>
                    <strong>{formatDateTime(nomination.createdAt)}</strong>
                  </div>
                  <div>
                    <span>Cập nhật lần cuối</span>
                    <strong>{formatDateTime(nomination.updatedAt)}</strong>
                  </div>
                  {nomination.submissionType === "GROUP" ? (
                    <div>
                      <span>Tên nhóm</span>
                      <strong>{nomination.groupName || "-"}</strong>
                    </div>
                  ) : null}
                  <div>
                    <span>Danh hiệu/Khen thưởng</span>
                    <strong>{nomination.awardType?.name || "-"}</strong>
                  </div>
                </div>
              </div>

              {nomination.submissionType === "GROUP" ? (
                <div className="detail-section">
                  <h4>Thành viên nhóm</h4>
                  {(nomination.members || []).length ? (
                    <div className="detail-member-list">
                      {(nomination.members || []).map((member) => (
                        <div className="detail-member-card" key={member.id}>
                          <strong>
                            {member.fullName}
                            {member.isLeader ? <span>Trưởng nhóm</span> : null}
                          </strong>
                          <small>{memberRoleLabels[member.memberRole] || member.memberRole}</small>
                          <small>{member.email || "Chưa có email"}</small>
                          {member.contribution ? <p>{member.contribution}</p> : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="detail-muted">Chưa có thành viên nhóm.</p>
                  )}
                </div>
              ) : null}

              <div className="detail-section">
                <h4>Tiêu chí xét và minh chứng</h4>
                {nomination.awardType?.criteria?.length ? (
                  <div className="detail-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Tiêu chí danh hiệu</th>
                          <th>Điểm tối thiểu</th>
                          <th>Minh chứng</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(nomination.awardType?.criteria || []).map((criterion) => {
                          const evidence = (nomination.evidences || []).find((item) => item.awardCriterionId === criterion.id);
                          return (
                            <tr key={criterion.id}>
                              <td>
                                <strong>{criterion.title}</strong>
                                {criterion.description ? <small>{criterion.description}</small> : null}
                              </td>
                              <td>{criterion.minPoint ?? "-"}</td>
                              <td>{evidence ? "Có" : "Chưa có"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (nomination.items || []).length ? (
                  <div className="detail-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Tiêu chí</th>
                          <th>Điểm tối đa</th>
                          <th>Điểm hồ sơ</th>
                          <th>Minh chứng theo tiêu chí</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(nomination.items || []).map((item) => (
                          <tr key={item.id}>
                            <td>
                              <strong>{item.criteria?.title || item.criteria?.code || `Tiêu chí #${item.criteriaId}`}</strong>
                              {item.criteria?.code ? <small>{item.criteria.code}</small> : null}
                              {item.criteria?.description ? <small>{item.criteria.description}</small> : null}
                              {(item.criteria?.subItems || []).length ? (
                                <ul className="detail-subitem-list">
                                  {(item.criteria?.subItems || []).map((subItem) => (
                                    <li key={subItem.id}>
                                      {subItem.title} ({subItem.maxPoint || 0} điểm)
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
                            </td>
                            <td>{item.criteria?.maxPoint ?? "-"}</td>
                            <td>{item.selfPoint ?? 0}</td>
                            <td>{item.evidence ? "Có" : "Chưa có"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="detail-muted">Chưa có tiêu chí trong hồ sơ.</p>
                )}
              </div>

              <div className="detail-section">
                <h4>Minh chứng điện tử</h4>
                {canScoreEvidenceInDetail ? (
                  <div className="detail-score-summary">
                    <div>
                      <span>Chấm điểm cấp khoa</span>
                      <strong>Tổng điểm tạm tính: {getDetailEvidenceScoreTotal(evidenceEntries)}</strong>
                    </div>
                    <small>Nhập điểm cho từng file minh chứng, sau đó bấm duyệt để hệ thống lưu tổng điểm hồ sơ.</small>
                  </div>
                ) : null}
                {evidenceEntries.length ? (
                  <div className={canScoreEvidenceInDetail ? "detail-evidence-score-list" : "detail-evidence-list"}>
                    {evidenceEntries.map((entry, index) => (
                      entry.id ? (
                        <div className="detail-evidence-score-row" key={`${entry.url}-${index}`}>
                          <button
                            type="button"
                            className="detail-evidence-button"
                            onClick={() => openEvidence(entry, `minh-chung-${index + 1}`)}
                          >
                            Tệp minh chứng #{index + 1}
                          </button>
                          {entry.label ? <span>{entry.label}</span> : null}
                          {canScoreEvidenceInDetail ? (
                            <label>
                              Điểm minh chứng
                              <input
                                type="number"
                                min="0"
                                value={getDetailEvidenceScoreValue(entry)}
                                onChange={(event) => updateDetailEvidenceScore(entry.id, event.target.value)}
                                placeholder="Nhập điểm"
                              />
                            </label>
                          ) : entry.reviewPoint !== undefined && entry.reviewPoint !== null ? (
                            <strong>{entry.reviewPoint} điểm</strong>
                          ) : null}
                        </div>
                      ) : (
                        <span key={`${entry.url}-${index}`}>Tệp minh chứng #{index + 1}</span>
                      )
                    ))}
                  </div>
                ) : (
                  <p className="detail-muted">Hồ sơ chưa có tệp minh chứng.</p>
                )}
              </div>

              <div className="detail-section">
                <h4>Tiến trình xét duyệt</h4>
                {(nomination.reviews || []).length ? (
                  <div className="detail-review-list">
                    {(nomination.reviews || []).map((review) => (
                      <div className="detail-review-card" key={review.id}>
                        <div>
                          <strong>{reviewLevelLabel[review.level] || review.level}</strong>
                          <span className={`review-decision decision-${String(review.decision || "").toLowerCase()}`}>
                            {reviewDecisionLabel(review.decision)}
                          </span>
                        </div>
                        <small>Người xử lý: {review.reviewer?.fullName || "-"}</small>
                        <small>Hạn xử lý: {formatDateTime(review.dueAt)}</small>
                        <small>Ngày xử lý: {formatDateTime(review.reviewedAt)}</small>
                        {review.comment ? <p>{review.comment}</p> : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="detail-muted">Hồ sơ chưa được nộp duyệt.</p>
                )}
              </div>

              <div className="modal-actions">
                {canScoreEvidenceInDetail ? (
                  <>
                    <textarea
                      className="detail-review-comment"
                      placeholder="Nhận xét cấp khoa (không bắt buộc)"
                      value={detailReviewComment}
                      onChange={(event) => setDetailReviewComment(event.target.value)}
                    />
                    <button
                      type="button"
                      className="btn-submit-small"
                      disabled={decidingReviewId === getMyPendingReviewStep(nomination)?.id}
                      onClick={() => approveDetailKhoaReview(nomination, evidenceEntries)}
                    >
                      {decidingReviewId === getMyPendingReviewStep(nomination)?.id ? "Đang xử lý..." : "Duyệt và lưu điểm"}
                    </button>
                    <button
                      type="button"
                      className="btn-detail-small danger"
                      disabled={decidingReviewId === getMyPendingReviewStep(nomination)?.id}
                      onClick={() => rejectDetailKhoaReview(nomination)}
                    >
                      {decidingReviewId === getMyPendingReviewStep(nomination)?.id ? "Đang xử lý..." : "Từ chối hồ sơ"}
                    </button>
                  </>
                ) : null}
                <button type="button" className="btn-cancel" onClick={closeDetailModal}>Đóng</button>
              </div>
            </div>
          </div>
        );
      })(), document.body) : null}
      {scoreModal.open && scoreModal.nomination ? (
        <div className="modal-overlay">
          <div className="modal" role="dialog" aria-modal="true">
            <div className="modal-header">
              <h3>Chấm điểm hồ sơ</h3>
              <button type="button" className="modal-close" onClick={closeScoreModal} aria-label="Đóng">
                ✕
              </button>
            </div>
            <p>
              Hồ sơ: <strong>{scoreModal.nomination.title}</strong> — Người nộp: {scoreModal.nomination.applicant?.fullName || ""}
            </p>
            <div className="modal-body">
              <table>
                <thead>
                  <tr>
                    <th>Tiêu chí</th>
                    <th>Minh chứng</th>
                    <th>Điểm (tối đa)</th>
                  </tr>
                </thead>
                <tbody>
                  {(scoreModal.nomination.items || []).map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div>{item.criteria?.code || "-"} — {item.criteria?.title || ""}</div>
                        {item.criteria?.description ? (
                          <small>{item.criteria.description}</small>
                        ) : null}
                      </td>
                      <td>{item.evidence ? "Có" : "Chưa có"}</td>
                      <td>
                        {(item.criteria?.subItems || []).length ? (
                          <div>
                            {(item.criteria?.subItems || []).map((subItem) => {
                              const key = `${item.id}_${subItem.id}`;
                              return (
                                <div key={subItem.id}>
                                  <small>{subItem.title}</small>
                                  <input
                                    type="number"
                                    min="0"
                                    max={subItem.maxPoint || 0}
                                    value={scoreModalSubScores[key] ?? ""}
                                    onChange={(e) => {
                                      const nextValue = e.target.value === "" ? "" : Number(e.target.value);
                                      setScoreModalSubScores((prev) => {
                                        const next = { ...prev, [key]: nextValue };
                                        const total = (item.criteria?.subItems || []).reduce((sum, currentSubItem) => {
                                          const currentKey = `${item.id}_${currentSubItem.id}`;
                                          const currentValue = next[currentKey];
                                          return sum + (currentValue === "" || currentValue === undefined ? 0 : Number(currentValue));
                                        }, 0);
                                        setScoreModalScores((prevScores) => ({
                                          ...prevScores,
                                          [item.id]: total,
                                        }));
                                        return next;
                                      });
                                    }}
                                  />
                                  <small> / {subItem.maxPoint || 0}</small>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <>
                            <input
                              type="number"
                              min="0"
                              max={item.criteria?.maxPoint || 0}
                              value={scoreModalScores[item.id] ?? ""}
                              onChange={(e) =>
                                setScoreModalScores((prev) => ({
                                  ...prev,
                                  [item.id]: e.target.value === "" ? "" : Number(e.target.value),
                                }))
                              }
                            />
                            <small> / {item.criteria?.maxPoint || 0}</small>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="form-group">
                <label>Nhận xét</label>
                <textarea
                  value={scoreModalComment}
                  onChange={(e) => setScoreModalComment(e.target.value)}
                  placeholder="Nhập nhận xét (nếu có)"
                />
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-primary" onClick={confirmScoreModal}>Xác nhận duyệt</button>
              <button type="button" className="btn-cancel" onClick={closeScoreModal}>Hủy</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

