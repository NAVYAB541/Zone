export type Task = {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  dueDate?: string | null;
  tags?: string[];
  category?: string;
  estimateMinutes?: number;
  energy?: 'high' | 'medium' | 'low' | null;
  nextAction?: string;
  parentTaskId?: string | null;
  createdAt?: string;
};

export type AISubtask = {
  title: string;
  description: string;
  estimateMinutes: number;
  nextAction: string;
  energy: 'high' | 'medium' | 'low';
};

export type AIPlanResult = {
  feasibility: { ok: boolean; message: string };
  subtasks: AISubtask[];
};

export type RootStackParamList = {
  TaskList: undefined;
  AddTask: undefined;
  TaskDetails: { task: Task };
  LaunchMe: undefined;
  FocusMode: { task: Task };
  AIPlanner: {
    title: string;
    description: string;
    category: string;
    priority: 'low' | 'medium' | 'high';
    dueDate: string | null;
    existingTaskId?: string;
  };
  About: undefined;
};
