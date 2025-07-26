'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Project, 
  ProjectStage, 
  Job, 
  ProjectGanttData,
  ProjectWithStats 
} from '@/lib/types';
import { format, addDays, differenceInDays, parseISO, startOfDay, endOfDay } from 'date-fns';

interface ProjectGanttChartProps {
  projects: ProjectWithStats[];
  viewMode?: 'timeline' | 'overview';
  onProjectSelect?: (project: Project) => void;
  className?: string;
}

interface GanttBarProps {
  stage: ProjectStage & { start_date: string; end_date: string; duration_days: number; progress: number };
  startDate: Date;
  endDate: Date;
  totalDays: number;
  onStageClick?: (stage: ProjectStage) => void;
}

function GanttBar({ stage, startDate, endDate, totalDays, onStageClick }: GanttBarProps) {
  const stageStart = parseISO(stage.start_date);
  const stageEnd = parseISO(stage.end_date);
  
  const daysFromStart = differenceInDays(stageStart, startDate);
  const stageDuration = differenceInDays(stageEnd, stageStart) + 1;
  
  const leftPercentage = Math.max(0, (daysFromStart / totalDays) * 100);
  const widthPercentage = Math.min(100 - leftPercentage, (stageDuration / totalDays) * 100);
  
  return (
    <div
      className="absolute h-6 rounded cursor-pointer group transition-all hover:h-7 hover:-mt-0.5"
      style={{
        left: `${leftPercentage}%`,
        width: `${widthPercentage}%`,
        backgroundColor: stage.color,
        opacity: 0.8
      }}
      onClick={() => onStageClick?.(stage)}
      title={`${stage.stage_name} (${stage.completion_percentage}%)`}
    >
      {/* Progress indicator */}
      <div 
        className="h-full bg-black bg-opacity-20 rounded-l"
        style={{ width: `${stage.completion_percentage}%` }}
      />
      
      {/* Stage label */}
      <div className="absolute left-2 top-0.5 text-xs font-medium text-white truncate max-w-full pr-2">
        {stage.stage_name}
      </div>
      
      {/* Tooltip on hover */}
      <div className="invisible group-hover:visible absolute bottom-8 left-0 bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
        {stage.stage_name}: {stage.completion_percentage}% complete
        <br />
        {format(stageStart, 'MMM d')} - {format(stageEnd, 'MMM d')}
      </div>
    </div>
  );
}

export function ProjectGanttChart({ 
  projects, 
  viewMode = 'timeline',
  onProjectSelect,
  className 
}: ProjectGanttChartProps) {
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'3months' | '6months' | '1year'>('6months');
  const [ganttData, setGanttData] = useState<ProjectGanttData[]>([]);

  // Calculate date range for the Gantt view
  const today = new Date();
  const startDate = addDays(today, -30); // Start 30 days ago
  const endDate = addDays(today, timeRange === '3months' ? 90 : timeRange === '6months' ? 180 : 365);
  const totalDays = differenceInDays(endDate, startDate);

  // Generate date headers
  const generateDateHeaders = () => {
    const headers = [];
    const monthsToShow = Math.ceil(totalDays / 30);
    
    for (let i = 0; i < monthsToShow; i++) {
      const monthDate = addDays(startDate, i * 30);
      headers.push({
        date: monthDate,
        label: format(monthDate, 'MMM yyyy'),
        percentage: (30 / totalDays) * 100
      });
    }
    return headers;
  };

  const dateHeaders = generateDateHeaders();

  // Process projects into Gantt data
  useEffect(() => {
    const processedData: ProjectGanttData[] = projects.map(project => {
      const stages = project.stages?.map(stage => {
        const plannedStart = stage.planned_start_date ? parseISO(stage.planned_start_date) : startDate;
        const plannedEnd = stage.planned_end_date ? parseISO(stage.planned_end_date) : addDays(plannedStart, 7);
        
        return {
          ...stage,
          start_date: format(plannedStart, 'yyyy-MM-dd'),
          end_date: format(plannedEnd, 'yyyy-MM-dd'),
          duration_days: differenceInDays(plannedEnd, plannedStart) + 1,
          progress: stage.completion_percentage
        };
      }) || [];

      return {
        ...project,
        stages: stages.sort((a, b) => a.sequence_order - b.sequence_order)
      };
    });
    
    setGanttData(processedData);
  }, [projects, startDate]);

  const handleStageClick = (stage: ProjectStage) => {
    console.log('Stage clicked:', stage);
    // Add stage detail modal or navigation logic here
  };

  const handleProjectClick = (project: Project) => {
    if (selectedProject === project.id) {
      setSelectedProject(null);
    } else {
      setSelectedProject(project.id);
      onProjectSelect?.(project);
    }
  };

  if (viewMode === 'overview') {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Projects Overview</CardTitle>
            <div className="flex items-center space-x-2">
              <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
                <option value="3months">3 Months</option>
                <option value="6months">6 Months</option>
                <option value="1year">1 Year</option>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {ganttData.map(project => (
              <div key={project.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold">{project.name}</h3>
                  <div className="flex items-center space-x-2">
                    <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
                      {project.status}
                    </Badge>
                    <span className="text-sm text-gray-500">
                      {project.overall_completion}% complete
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-4 text-sm text-gray-600 mb-3">
                  <span>{project.client_name}</span>
                  <span>•</span>
                  <span>{project.total_stages} stages</span>
                  <span>•</span>
                  <span>{project.total_jobs} jobs</span>
                </div>
                
                {/* Mini timeline */}
                <div className="relative h-2 bg-gray-200 rounded overflow-hidden">
                  {project.stages.map(stage => (
                    <div
                      key={stage.id}
                      className="absolute h-full"
                      style={{
                        left: `${(stage.sequence_order - 1) * (100 / project.stages.length)}%`,
                        width: `${100 / project.stages.length}%`,
                        backgroundColor: stage.color,
                        opacity: stage.status === 'completed' ? 1 : 0.6
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Project Timeline</CardTitle>
          <div className="flex items-center space-x-2">
            <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
              <option value="3months">3 Months</option>
              <option value="6months">6 Months</option>
              <option value="1year">1 Year</option>
            </Select>
            <Button variant="outline" size="sm">
              Export PDF
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          {/* Date headers */}
          <div className="flex items-center border-b pb-2 mb-4 min-w-full">
            <div className="w-64 flex-shrink-0 font-medium">Project / Stage</div>
            <div className="flex-1 flex">
              {dateHeaders.map((header, index) => (
                <div 
                  key={index}
                  className="border-l px-2 text-center text-sm font-medium"
                  style={{ width: `${header.percentage}%` }}
                >
                  {header.label}
                </div>
              ))}
            </div>
          </div>

          {/* Project rows */}
          <div className="space-y-1 min-w-full">
            {ganttData.map(project => (
              <div key={project.id}>
                {/* Project header row */}
                <div className="flex items-center group">
                  <div 
                    className="w-64 flex-shrink-0 py-2 px-2 cursor-pointer hover:bg-gray-50 rounded"
                    onClick={() => handleProjectClick(project)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{project.name}</div>
                        <div className="text-sm text-gray-500">{project.client_name}</div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={project.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                          {project.status}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {project.overall_completion}%
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 relative h-8 border-l">
                    {/* Project timeline - overall project bar */}
                    {project.planned_start_date && project.planned_end_date && (
                      <div className="absolute inset-0 flex items-center">
                        <div 
                          className="h-2 bg-gray-300 rounded-full opacity-30"
                          style={{
                            left: `${Math.max(0, (differenceInDays(parseISO(project.planned_start_date), startDate) / totalDays) * 100)}%`,
                            width: `${Math.min(100, (differenceInDays(parseISO(project.planned_end_date), parseISO(project.planned_start_date)) / totalDays) * 100)}%`
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Stage rows (expanded) */}
                {selectedProject === project.id && project.stages.map(stage => (
                  <div key={stage.id} className="flex items-center bg-gray-50">
                    <div className="w-64 flex-shrink-0 py-2 px-6">
                      <div className="flex items-center space-x-2">
                        <div 
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: stage.color }}
                        />
                        <div>
                          <div className="text-sm font-medium">{stage.stage_name}</div>
                          <div className="text-xs text-gray-500">
                            {stage.status} • {stage.completion_percentage}%
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 relative h-8 border-l">
                      {stage.planned_start_date && stage.planned_end_date && (
                        <GanttBar
                          stage={{
                            ...stage,
                            start_date: stage.planned_start_date,
                            end_date: stage.planned_end_date,
                            duration_days: differenceInDays(parseISO(stage.planned_end_date), parseISO(stage.planned_start_date)) + 1,
                            progress: stage.completion_percentage
                          }}
                          startDate={startDate}
                          endDate={endDate}
                          totalDays={totalDays}
                          onStageClick={handleStageClick}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Today indicator */}
          <div 
            className="absolute top-0 bottom-0 w-px bg-red-500 z-10"
            style={{
              left: `${64 * 4 + (differenceInDays(today, startDate) / totalDays) * 100}%` // 64px * 4 for the 16rem (w-64) project name column
            }}
          >
            <div className="absolute -top-2 -left-2 w-4 h-4 bg-red-500 rounded-full" />
            <div className="absolute -top-6 -left-6 text-xs text-red-500 font-medium">Today</div>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-gray-300 rounded" />
                <span>Project Timeline</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-blue-500 rounded" />
                <span>Stage</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-black bg-opacity-20 rounded" />
                <span>Progress</span>
              </div>
            </div>
            <span>Click on project names to expand stages</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}