"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Button,
  Chip,
  InputGroup,
  Modal,
  Radio,
  RadioGroup,
  Spinner,
  TextField,
  toast,
} from "@heroui/react";
import {
  advisorListApi,
  advisorSlotListApi,
  studentAppointmentCreateApi,
  type AdvisorCard,
  type AdvisorSlot,
} from "@/api/user";
import Paginator from "@/components/pa/Paginator";
import SelectField from "@/components/pa/SelectField";
import { isTrue } from "@/utils/format";

const PAGE_SIZE = 12;
const ALL = "__all__";

interface BookingForm {
  topic: string;
  content: string;
  mode: string;
  phone: string;
  wechat: string;
  meeting_link: string;
}

const emptyForm: BookingForm = {
  topic: "",
  content: "",
  mode: "online",
  phone: "",
  wechat: "",
  meeting_link: "",
};

/** 顾问头像：photo 为 base64 data URL；无则显示占位色块 + 姓名首字 */
function AdvisorAvatar({ name, photo }: { name: string; photo: string }) {
  if (photo && photo.startsWith("data:")) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photo} alt={name} className="w-16 h-16 rounded-full object-cover shrink-0" />;
  }
  return (
    <div className="w-16 h-16 rounded-full bg-[#5b2a86] text-white flex items-center justify-center text-2xl font-bold shrink-0">
      {(name || "?").charAt(0)}
    </div>
  );
}

export default function AdvisorBrowseView() {
  const t = useTranslations("advisorBrowse");
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [itemCount, setItemCount] = useState(0);
  const [advisors, setAdvisors] = useState<AdvisorCard[]>([]);
  const [majors, setMajors] = useState<string[]>([]);
  const [directions, setDirections] = useState<string[]>([]);
  const [major, setMajor] = useState(ALL);
  const [direction, setDirection] = useState(ALL);

  // 预约弹窗
  const [bookTarget, setBookTarget] = useState<AdvisorCard | null>(null);
  const [slots, setSlots] = useState<AdvisorSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [form, setForm] = useState<BookingForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const getData = useCallback(
    async (pageNo = page, m = major, d = direction) => {
      setLoading(true);
      try {
        const res = await advisorListApi({
          page: pageNo,
          pageSize: PAGE_SIZE,
          major: m === ALL ? "" : m,
          direction: d === ALL ? "" : d,
        });
        setAdvisors(res.list || []);
        setItemCount(Number(res.total) || 0);
        setMajors(res.majors || []);
        setDirections(res.directions || []);
      } catch (error) {
        toast.danger((error as Error).message || t("failToLoad"));
        setAdvisors([]);
      }
      setLoading(false);
    },
    [page, major, direction, t]
  );

  useEffect(() => {
    getData(1);
    // 直达参数（管理端「预览」跳转）：?advisorId=.. 自动打开该顾问的预约弹窗，
    // ?slotId=.. 预选时段（仅当其对学生可见时）。仅客户端解析 location.search，
    // 避免 useSearchParams 需 Suspense 包裹。
    const params = new URLSearchParams(window.location.search);
    const advisorId = params.get("advisorId");
    if (advisorId) {
      openBookingById(advisorId, params.get("slotId") || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilterChange = (m: string, d: string) => {
    setMajor(m);
    setDirection(d);
    setPage(1);
    getData(1, m, d);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    getData(newPage);
  };

  const openBooking = (adv: AdvisorCard) => {
    setBookTarget(adv);
    setSelectedSlotId("");
    setForm(emptyForm);
    setSlots([]);
    setSlotsLoading(true);
    advisorSlotListApi(adv.advisorId)
      .then((res) => setSlots(res.list || []))
      .catch((error) => toast.danger((error as Error).message || t("failToLoadSlots")))
      .finally(() => setSlotsLoading(false));
  };

  /** 按 advisorId 直达预约弹窗（卡片可能不在当前分页，顾问姓名由时段接口回填） */
  const openBookingById = (advisorId: string, slotId: string) => {
    setBookTarget({
      advisorId,
      name: "",
      grade: "",
      major: "",
      direction: "",
      bio: "",
      photo: "",
      accepting: "1",
      slots: [],
    });
    setSelectedSlotId("");
    setForm(emptyForm);
    setSlots([]);
    setSlotsLoading(true);
    advisorSlotListApi(advisorId)
      .then((res) => {
        setSlots(res.list || []);
        setBookTarget((prev) => (prev ? { ...prev, name: res.name } : prev));
        // 预选目标时段：仅当其对学生可见（开放、未满、距开始 > 24h）
        if (slotId && (res.list || []).some((item) => item.slotId === slotId)) {
          setSelectedSlotId(slotId);
        }
      })
      .catch((error) => {
        setBookTarget(null);
        toast.danger((error as Error).message || t("failToLoadSlots"));
      })
      .finally(() => setSlotsLoading(false));
  };

  /** 前端校验：时段必选；topic/content/mode/phone 必填；online 时 wechat 必填 */
  const validate = (): string | null => {
    if (!selectedSlotId) return t("validation.slotRequired");
    if (!form.topic.trim()) return t("validation.topicRequired");
    if (!form.content.trim()) return t("validation.contentRequired");
    if (!form.mode) return t("validation.modeRequired");
    if (!form.phone.trim()) return t("validation.phoneRequired");
    if (form.mode === "online" && !form.wechat.trim()) {
      return t("validation.wechatRequired");
    }
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      toast.danger(err);
      return;
    }
    setSubmitting(true);
    try {
      await studentAppointmentCreateApi({
        slotId: selectedSlotId,
        topic: form.topic.trim(),
        content: form.content.trim(),
        mode: form.mode,
        phone: form.phone.trim(),
        wechat: form.wechat.trim(),
        meetingLink: form.mode === "online" ? form.meeting_link.trim() : "",
      });
      toast.success(t("bookedSuccess"));
      setBookTarget(null);
      getData();
    } catch (error) {
      toast.danger((error as Error).message || t("failToBook"));
    }
    setSubmitting(false);
  };

  const totalPages = Math.max(1, Math.ceil(itemCount / PAGE_SIZE));
  const withAll = (list: string[]) => [
    { value: ALL, label: t("all") },
    ...list.map((v) => ({ value: v, label: v })),
  ];

  return (
    <div>
      {/* 筛选工具栏：专业 / 擅长方向 */}
      <div className="bg-white p-5 mb-2 flex items-center gap-6 flex-wrap">
        <SelectField
          label={t("major")}
          value={major}
          options={withAll(majors)}
          onChange={(v) => handleFilterChange(v || ALL, direction)}
        />
        <SelectField
          label={t("direction")}
          value={direction}
          options={withAll(directions)}
          onChange={(v) => handleFilterChange(major, v || ALL)}
        />
        {loading && <Spinner size="sm" aria-label={t("loading")} />}
      </div>

      {/* 顾问卡片网格 */}
      {advisors.length === 0 && !loading ? (
        <div className="bg-white p-10 text-center text-gray-400">{t("noAdvisors")}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {advisors.map((adv) => {
            const accepting = isTrue(adv.accepting);
            return (
              <div key={adv.advisorId} className="bg-white rounded-lg shadow-sm p-4 flex flex-col">
                <div className="flex items-start gap-3">
                  <AdvisorAvatar name={adv.name} photo={adv.photo} />
                  <div className="min-w-0">
                    <div className="font-bold text-gray-800 flex items-center gap-2">
                      {adv.name}
                      {!accepting && <Chip color="warning">{t("unavailable")}</Chip>}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {[adv.grade, adv.major].filter(Boolean).join(" · ")}
                    </div>
                    {adv.direction && (
                      <div className="mt-1">
                        <Chip color="accent">{adv.direction}</Chip>
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-3 text-sm text-gray-600 line-clamp-3 min-h-[40px]">
                  {adv.bio || t("noBio")}
                </div>
                {/* 近期可约时段 */}
                <div className="mt-3 flex flex-wrap gap-1">
                  {(adv.slots || []).slice(0, 4).map((s) => (
                    <Chip key={s.slotId} className="text-xs">
                      {s.startTime}
                    </Chip>
                  ))}
                  {(adv.slots || []).length === 0 && (
                    <span className="text-xs text-gray-400">{t("noSlots")}</span>
                  )}
                </div>
                <div className="mt-4 flex justify-end">
                  <Button
                    size="sm"
                    variant="primary"
                    isDisabled={!accepting}
                    onPress={() => openBooking(adv)}
                  >
                    {t("book")}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-2">
        <Paginator page={page} totalPages={totalPages} loading={loading} onChange={handlePageChange} />
      </div>

      {/* 预约弹窗：选时段 -> 填表单 */}
      <Modal isOpen={!!bookTarget} onOpenChange={(open) => !open && setBookTarget(null)}>
        <Modal.Backdrop>
          <Modal.Container size="lg" placement="center">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>{t("bookWith", { name: bookTarget?.name ?? "" })}</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <div className="mb-2 text-sm font-bold text-gray-700">{t("stepSlot")}</div>
                {slotsLoading ? (
                  <div className="p-4 flex justify-center">
                    <Spinner aria-label={t("loadingSlots")} />
                  </div>
                ) : slots.length === 0 ? (
                  <div className="p-4 text-center text-gray-400 text-sm">{t("noSlots")}</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                    {slots.map((s) => {
                      const full = Number(s.booked) > 0;
                      const selected = selectedSlotId === s.slotId;
                      return (
                        <button
                          key={s.slotId}
                          type="button"
                          disabled={full}
                          onClick={() => setSelectedSlotId(s.slotId)}
                          className={`text-left text-xs rounded border px-3 py-2 transition-colors ${
                            selected
                              ? "border-[#5b2a86] bg-[#f5f0fa] text-[#5b2a86] font-bold"
                              : full
                                ? "border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed"
                                : "border-gray-300 hover:border-[#5b2a86]"
                          }`}
                        >
                          <div>{s.startTime}</div>
                          <div>~ {s.endTime}</div>
                          <div className="mt-1">
                            {full ? t("full") : t("available")}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="mt-4 mb-2 text-sm font-bold text-gray-700">{t("stepForm")}</div>
                <div className="flex flex-col gap-3">
                  <TextField
                    value={form.topic}
                    onChange={(v) => setForm((s) => ({ ...s, topic: v }))}
                    aria-label={t("topic")}
                  >
                    <InputGroup>
                      <InputGroup.Prefix className="w-28">{t("topicRequired")}</InputGroup.Prefix>
                      <InputGroup.Input placeholder={t("topicPlaceholder")} />
                    </InputGroup>
                  </TextField>
                  <div>
                    <div className="text-sm text-gray-600 mb-1">{t("contentRequired")}</div>
                    <textarea
                      className="w-full h-20 rounded-lg border border-gray-300 p-2 text-sm"
                      value={form.content}
                      onChange={(e) => setForm((s) => ({ ...s, content: e.target.value }))}
                      placeholder={t("contentPlaceholder")}
                    />
                  </div>
                  <RadioGroup
                    value={form.mode}
                    onChange={(v) => setForm((s) => ({ ...s, mode: v }))}
                    orientation="horizontal"
                    aria-label={t("mode")}
                  >
                    <span className="text-sm text-gray-600 mr-2">{t("modeRequired")}</span>
                    {["online", "offline"].map((m) => (
                      <Radio className="capitalize" key={m} value={m}>
                        <Radio.Content>
                          <Radio.Control>
                            <Radio.Indicator />
                          </Radio.Control>
                          {m === "online" ? t("modeOnline") : t("modeOffline")}
                        </Radio.Content>
                      </Radio>
                    ))}
                  </RadioGroup>
                  <TextField
                    value={form.phone}
                    onChange={(v) => setForm((s) => ({ ...s, phone: v }))}
                    aria-label={t("phone")}
                  >
                    <InputGroup>
                      <InputGroup.Prefix className="w-28">{t("phoneRequired")}</InputGroup.Prefix>
                      <InputGroup.Input placeholder={t("phonePlaceholder")} />
                    </InputGroup>
                  </TextField>
                  <TextField
                    value={form.wechat}
                    onChange={(v) => setForm((s) => ({ ...s, wechat: v }))}
                    aria-label={t("wechat")}
                  >
                    <InputGroup>
                      <InputGroup.Prefix className="w-28">
                        {form.mode === "online" ? t("wechatRequired") : t("wechat")}
                      </InputGroup.Prefix>
                      <InputGroup.Input
                        placeholder={
                          form.mode === "online"
                            ? t("wechatRequiredPlaceholder")
                            : t("optionalPlaceholder")
                        }
                      />
                    </InputGroup>
                  </TextField>
                  {/* 线上咨询可附会议链接 */}
                  {form.mode === "online" && (
                    <TextField
                      value={form.meeting_link}
                      onChange={(v) => setForm((s) => ({ ...s, meeting_link: v }))}
                      aria-label={t("meetingLink")}
                    >
                      <InputGroup>
                        <InputGroup.Prefix className="w-28">{t("meetingLink")}</InputGroup.Prefix>
                        <InputGroup.Input placeholder={t("meetingLinkPlaceholder")} />
                      </InputGroup>
                    </TextField>
                  )}
                </div>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="ghost" onPress={() => setBookTarget(null)}>
                  {t("cancel")}
                </Button>
                <Button variant="primary" isPending={submitting} onPress={handleSubmit}>
                  {t("submit")}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}
