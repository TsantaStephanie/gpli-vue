import axios from 'axios'

export interface KanbanSetting {
  columnId: string   // "new" | "progress" | "done"
  color: string      // hex ex: "#3b82f6"
  labelMg: string    // nom malgache ex: "Vaovao"
}

const BASE = '/api/kanban-settings'

export async function getKanbanSettings(): Promise<KanbanSetting[]> {
  const res = await axios.get<KanbanSetting[]>(BASE)
  return res.data
}

export async function saveKanbanSettings(settings: KanbanSetting[]): Promise<KanbanSetting[]> {
  const res = await axios.put<KanbanSetting[]>(BASE, settings)
  return res.data
}
