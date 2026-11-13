"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "@heroui/react";
import { manageAdvisorListApi, type ManageAdvisor } from "@/api/admin";
import type { MySlot } from "@/api/advisor";
import { useUserStore } from "@/context/UserContext";
import SelectField from "@/components/pa/SelectField";
import ScheduleView from "@/views/ScheduleView";

/** D-2 排期代管：选中顾问后管理其排期（接口均带 advisorId；顾问本人走 /advisor 门户自助管理） */
export default function ScheduleManagementView() {
  const t = useTranslations("schedule");
  // 数据域：advisor 仅能管理本人排期——列表接口只返回本人档案，自动选中且不展示切换
  const { state: userState } = useUserStore();
  const isAdminUser = userState.role === "admin";
  const [advisors, setAdvisors] = useState<ManageAdvisor[]>([]);
  const [advisorId, setAdvisorId] = useState("");

  /** 学生端预览：新标签页打开真实的学生端顾问广场，直达该顾问的预约弹窗并预选该时段 */
  const handlePreview = (row: MySlot) => {
    const params = new URLSearchParams({ advisorId, slotId: row.slotId });
    window.open(`/f/007/user/advisors?${params.toString()}`, "_blank", "noopener");
  };

  useEffect(() => {
    manageAdvisorListApi({ page: 1, pageSize: 100, keyword: "" })
      .then((res) => {
        const list = res.list || [];
        setAdvisors(list);
        // advisor 后端只回本人档案，直接锁定本人排期
        if (!isAdminUser && list.length) setAdvisorId(String(list[0].advisorId));
      })
      .catch((error) => toast.danger((error as Error).message || t("advisorsFail")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdminUser]);

  return (
    <div>
      {isAdminUser && (
        <div className="bg-white p-5 mb-2 flex items-center gap-3">
          <SelectField
            label={t("advisorLabel")}
            value={advisorId}
            options={advisors.map((a) => ({
              value: String(a.advisorId),
              label: `${a.name} (${a.username})`,
            }))}
            onChange={setAdvisorId}
            placeholder={t("advisorPlaceholder")}
            className="w-64"
          />
        </div>
      )}
      {advisorId ? (
        <ScheduleView key={advisorId} advisorId={advisorId} onPreview={handlePreview} />
      ) : (
        <div className="bg-white p-10 text-center text-gray-400">
          {t("selectAdvisorTip")}
        </div>
      )}
    </div>
  );
}
