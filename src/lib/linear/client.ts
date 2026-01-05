/**
 * Linear SDK Client Wrapper
 * 封装 Linear API 常用操作
 */
import { LinearClient } from '@linear/sdk'

export interface LinearUser {
  id: string
  name: string
  email: string
}

export interface LinearTeam {
  id: string
  name: string
  key: string
}

export interface LinearProject {
  id: string
  name: string
  state: string
}

export interface LinearWorkflowState {
  id: string
  name: string
  type: string
  color: string
}

/**
 * 创建 Linear 客户端实例
 */
export function createLinearClient(apiKey: string): LinearClient {
  return new LinearClient({ apiKey })
}

/**
 * 验证 API Key 是否有效
 * @returns 用户信息 (如果有效) 或 null (如果无效)
 */
export async function validateApiKey(apiKey: string): Promise<LinearUser | null> {
  try {
    const client = new LinearClient({ apiKey })
    const viewer = await client.viewer
    return {
      id: viewer.id,
      name: viewer.name || '',
      email: viewer.email || '',
    }
  } catch {
    return null
  }
}

/**
 * 获取用户所属的团队列表
 */
export async function getTeams(client: LinearClient): Promise<LinearTeam[]> {
  const teams = await client.teams()
  return teams.nodes.map(team => ({
    id: team.id,
    name: team.name,
    key: team.key,
  }))
}

/**
 * 获取团队下的项目列表
 */
export async function getProjects(client: LinearClient, teamId: string): Promise<LinearProject[]> {
  const team = await client.team(teamId)
  const projects = await team.projects()
  return projects.nodes.map(project => ({
    id: project.id,
    name: project.name,
    state: project.state,
  }))
}

/**
 * 获取团队的工作流状态
 */
export async function getWorkflowStates(client: LinearClient, teamId: string): Promise<LinearWorkflowState[]> {
  const states = await client.workflowStates({
    filter: { team: { id: { eq: teamId } } }
  })
  return states.nodes.map(state => ({
    id: state.id,
    name: state.name,
    type: state.type,
    color: state.color,
  }))
}
