'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LocationAutocomplete } from '@/components/ui/location-autocomplete';
import { FormanSelect } from '@/components/ui/foreman-select';
import { 
  Project, 
  ProjectStageTemplate, 
  ProjectStageDefinition,
  User 
} from '@/lib/types';

interface ProjectCreationWizardProps {
  onProjectCreated: (project: Project) => void;
  onCancel: () => void;
  companyId?: string;
}

interface ProjectFormData {
  name: string;
  description: string;
  client_name: string;
  site_address: string;
  address_components?: any;
  latitude?: number;
  longitude?: number;
  planned_start_date: string;
  planned_end_date: string;
  total_budget: string;
  project_manager_id: string;
  selectedTemplate?: ProjectStageTemplate;
  customStages: ProjectStageDefinition[];
}

const DEFAULT_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', 
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e'
];

export function ProjectCreationWizard({ 
  onProjectCreated, 
  onCancel, 
  companyId 
}: ProjectCreationWizardProps) {
  const [currentStep, setCurrentStep] = useState('details');
  const [isLoading, setIsLoading] = useState(false);
  const [templates, setTemplates] = useState<ProjectStageTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  
  const [formData, setFormData] = useState<ProjectFormData>({
    name: '',
    description: '',
    client_name: '',
    site_address: '',
    planned_start_date: '',
    planned_end_date: '',
    total_budget: '',
    project_manager_id: '',
    customStages: [
      { name: 'Planning', color: '#6366f1', sequence: 1, estimated_days: 7 },
      { name: 'Execution', color: '#8b5cf6', sequence: 2, estimated_days: 14 },
      { name: 'Completion', color: '#06b6d4', sequence: 3, estimated_days: 3 }
    ]
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load templates when moving to stage setup
  const loadTemplates = async () => {
    if (templates.length > 0) return;
    
    setLoadingTemplates(true);
    try {
      const response = await fetch('/api/project-stage-templates');
      if (response.ok) {
        const data = await response.json();
        setTemplates(data);
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const validateStep = (step: string): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 'details') {
      if (!formData.name.trim()) newErrors.name = 'Project name is required';
      if (!formData.client_name.trim()) newErrors.client_name = 'Client name is required';
      if (!formData.site_address.trim()) newErrors.site_address = 'Site address is required';
      if (!formData.planned_start_date) newErrors.planned_start_date = 'Start date is required';
      if (!formData.planned_end_date) newErrors.planned_end_date = 'End date is required';
      if (formData.planned_start_date && formData.planned_end_date && 
          new Date(formData.planned_start_date) >= new Date(formData.planned_end_date)) {
        newErrors.planned_end_date = 'End date must be after start date';
      }
    }

    if (step === 'stages') {
      if (!formData.selectedTemplate && formData.customStages.length === 0) {
        newErrors.stages = 'Please select a template or create custom stages';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep === 'details') {
        setCurrentStep('stages');
        loadTemplates();
      } else if (currentStep === 'stages') {
        setCurrentStep('review');
      }
    }
  };

  const handleBack = () => {
    if (currentStep === 'stages') {
      setCurrentStep('details');
    } else if (currentStep === 'review') {
      setCurrentStep('stages');
    }
  };

  const handleLocationSelect = (location: any) => {
    setFormData(prev => ({
      ...prev,
      site_address: location.formatted,
      address_components: location.address_components,
      latitude: location.lat,
      longitude: location.lon
    }));
  };

  const handleTemplateSelect = (template: ProjectStageTemplate) => {
    setFormData(prev => ({
      ...prev,
      selectedTemplate: template,
      customStages: []
    }));
  };

  const handleCustomStageAdd = () => {
    const newStage: ProjectStageDefinition = {
      name: '',
      color: DEFAULT_COLORS[formData.customStages.length % DEFAULT_COLORS.length],
      sequence: formData.customStages.length + 1,
      estimated_days: 7
    };
    
    setFormData(prev => ({
      ...prev,
      customStages: [...prev.customStages, newStage],
      selectedTemplate: undefined
    }));
  };

  const handleCustomStageUpdate = (index: number, field: keyof ProjectStageDefinition, value: any) => {
    setFormData(prev => ({
      ...prev,
      customStages: prev.customStages.map((stage, i) => 
        i === index ? { ...stage, [field]: value } : stage
      )
    }));
  };

  const handleCustomStageRemove = (index: number) => {
    setFormData(prev => ({
      ...prev,
      customStages: prev.customStages.filter((_, i) => i !== index)
        .map((stage, i) => ({ ...stage, sequence: i + 1 }))
    }));
  };

  const handleSubmit = async () => {
    if (!validateStep('stages')) return;

    setIsLoading(true);
    try {
      // Create the project
      const projectData = {
        name: formData.name,
        description: formData.description,
        client_name: formData.client_name,
        site_address: formData.site_address,
        address_components: formData.address_components,
        latitude: formData.latitude,
        longitude: formData.longitude,
        planned_start_date: formData.planned_start_date,
        planned_end_date: formData.planned_end_date,
        total_budget: formData.total_budget ? parseFloat(formData.total_budget) : undefined,
        project_manager_id: formData.project_manager_id || undefined,
        company_id: companyId
      };

      const projectResponse = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectData)
      });

      if (!projectResponse.ok) {
        throw new Error('Failed to create project');
      }

      const project = await projectResponse.json();

      // Apply template or create custom stages
      if (formData.selectedTemplate) {
        await fetch(`/api/projects/${project.id}/apply-template`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            template_id: formData.selectedTemplate.id,
            start_date: formData.planned_start_date
          })
        });
      } else if (formData.customStages.length > 0) {
        // Create custom stages
        for (const stage of formData.customStages) {
          await fetch(`/api/projects/${project.id}/stages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              stage_name: stage.name,
              color: stage.color,
              sequence_order: stage.sequence,
              estimated_hours: stage.estimated_days * 8
            })
          });
        }
      }

      onProjectCreated(project);

    } catch (error) {
      console.error('Project creation error:', error);
      setErrors({ submit: 'Failed to create project. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-2">Create New Project</h2>
        <div className="flex items-center space-x-4">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            currentStep === 'details' ? 'bg-blue-600 text-white' : 
            ['stages', 'review'].includes(currentStep) ? 'bg-green-600 text-white' : 'bg-gray-300'
          }`}>
            1
          </div>
          <div className="w-16 h-1 bg-gray-300 rounded">
            <div className={`h-full bg-blue-600 rounded transition-all ${
              ['stages', 'review'].includes(currentStep) ? 'w-full' : 'w-0'
            }`} />
          </div>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            currentStep === 'stages' ? 'bg-blue-600 text-white' : 
            currentStep === 'review' ? 'bg-green-600 text-white' : 'bg-gray-300'
          }`}>
            2
          </div>
          <div className="w-16 h-1 bg-gray-300 rounded">
            <div className={`h-full bg-blue-600 rounded transition-all ${
              currentStep === 'review' ? 'w-full' : 'w-0'
            }`} />
          </div>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            currentStep === 'review' ? 'bg-blue-600 text-white' : 'bg-gray-300'
          }`}>
            3
          </div>
        </div>
        <div className="flex items-center justify-between mt-2 text-sm text-gray-600">
          <span>Project Details</span>
          <span>Stage Setup</span>
          <span>Review & Create</span>
        </div>
      </div>

      {currentStep === 'details' && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Project Details</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="name">Project Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className={errors.name ? 'border-red-500' : ''}
              />
              {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name}</p>}
            </div>

            <div>
              <Label htmlFor="client_name">Client Name *</Label>
              <Input
                id="client_name"
                value={formData.client_name}
                onChange={(e) => setFormData(prev => ({ ...prev, client_name: e.target.value }))}
                className={errors.client_name ? 'border-red-500' : ''}
              />
              {errors.client_name && <p className="text-sm text-red-500 mt-1">{errors.client_name}</p>}
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="site_address">Site Address *</Label>
              <LocationAutocomplete
                value={formData.site_address}
                onLocationSelect={handleLocationSelect}
                className={errors.site_address ? 'border-red-500' : ''}
              />
              {errors.site_address && <p className="text-sm text-red-500 mt-1">{errors.site_address}</p>}
            </div>

            <div>
              <Label htmlFor="planned_start_date">Planned Start Date *</Label>
              <Input
                id="planned_start_date"
                type="date"
                value={formData.planned_start_date}
                onChange={(e) => setFormData(prev => ({ ...prev, planned_start_date: e.target.value }))}
                className={errors.planned_start_date ? 'border-red-500' : ''}
              />
              {errors.planned_start_date && <p className="text-sm text-red-500 mt-1">{errors.planned_start_date}</p>}
            </div>

            <div>
              <Label htmlFor="planned_end_date">Planned End Date *</Label>
              <Input
                id="planned_end_date"
                type="date"
                value={formData.planned_end_date}
                onChange={(e) => setFormData(prev => ({ ...prev, planned_end_date: e.target.value }))}
                className={errors.planned_end_date ? 'border-red-500' : ''}
              />
              {errors.planned_end_date && <p className="text-sm text-red-500 mt-1">{errors.planned_end_date}</p>}
            </div>

            <div>
              <Label htmlFor="total_budget">Total Budget</Label>
              <Input
                id="total_budget"
                type="number"
                step="0.01"
                value={formData.total_budget}
                onChange={(e) => setFormData(prev => ({ ...prev, total_budget: e.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="project_manager_id">Project Manager</Label>
              <FormanSelect
                value={formData.project_manager_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, project_manager_id: value }))}
                placeholder="Select project manager"
              />
            </div>
          </div>
        </Card>
      )}

      {currentStep === 'stages' && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Project Stages Setup</h3>
          
          <Tabs defaultValue="templates" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="templates">Use Template</TabsTrigger>
              <TabsTrigger value="custom">Custom Stages</TabsTrigger>
            </TabsList>
            
            <TabsContent value="templates" className="space-y-4">
              {loadingTemplates ? (
                <div className="text-center py-8">Loading templates...</div>
              ) : (
                <div className="grid gap-4">
                  {templates.map((template) => (
                    <div 
                      key={template.id}
                      className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                        formData.selectedTemplate?.id === template.id 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => handleTemplateSelect(template)}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium">{template.template_name}</h4>
                          <p className="text-sm text-gray-600">{template.description}</p>
                          <div className="flex items-center mt-2 space-x-2">
                            <span className="text-xs px-2 py-1 bg-gray-100 rounded">
                              {template.industry_type}
                            </span>
                            <span className="text-xs px-2 py-1 bg-gray-100 rounded">
                              {template.stages.length} stages
                            </span>
                          </div>
                        </div>
                        {template.is_system_template && (
                          <span className="text-xs px-2 py-1 bg-green-100 text-green-600 rounded">
                            System
                          </span>
                        )}
                      </div>
                      <div className="flex items-center mt-3 space-x-2">
                        {template.stages.map((stage, index) => (
                          <div 
                            key={index} 
                            className="w-4 h-4 rounded"
                            style={{ backgroundColor: stage.color }}
                            title={stage.name}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="custom" className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-medium">Custom Stages</h4>
                <Button onClick={handleCustomStageAdd} variant="outline" size="sm">
                  Add Stage
                </Button>
              </div>
              
              <div className="space-y-3">
                {formData.customStages.map((stage, index) => (
                  <div key={index} className="flex items-center space-x-3 p-3 border rounded">
                    <div className="w-8 h-8 rounded flex items-center justify-center text-white text-sm font-medium"
                         style={{ backgroundColor: stage.color }}>
                      {stage.sequence}
                    </div>
                    <Input
                      placeholder="Stage name"
                      value={stage.name}
                      onChange={(e) => handleCustomStageUpdate(index, 'name', e.target.value)}
                      className="flex-1"
                    />
                    <input
                      type="color"
                      value={stage.color}
                      onChange={(e) => handleCustomStageUpdate(index, 'color', e.target.value)}
                      className="w-10 h-8 border rounded cursor-pointer"
                    />
                    <Input
                      type="number"
                      placeholder="Days"
                      value={stage.estimated_days}
                      onChange={(e) => handleCustomStageUpdate(index, 'estimated_days', parseInt(e.target.value) || 7)}
                      className="w-20"
                    />
                    <Button 
                      onClick={() => handleCustomStageRemove(index)}
                      variant="outline" 
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
          
          {errors.stages && <p className="text-sm text-red-500 mt-2">{errors.stages}</p>}
        </Card>
      )}

      {currentStep === 'review' && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Review & Create</h3>
          
          <div className="space-y-6">
            <div>
              <h4 className="font-medium mb-2">Project Information</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><strong>Name:</strong> {formData.name}</div>
                <div><strong>Client:</strong> {formData.client_name}</div>
                <div><strong>Start Date:</strong> {formData.planned_start_date}</div>
                <div><strong>End Date:</strong> {formData.planned_end_date}</div>
                <div className="col-span-2"><strong>Address:</strong> {formData.site_address}</div>
                {formData.description && (
                  <div className="col-span-2"><strong>Description:</strong> {formData.description}</div>
                )}
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-2">Project Stages</h4>
              {formData.selectedTemplate ? (
                <div>
                  <p className="text-sm text-gray-600 mb-2">Using template: {formData.selectedTemplate.template_name}</p>
                  <div className="flex items-center space-x-2">
                    {formData.selectedTemplate.stages.map((stage, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <div 
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: stage.color }}
                        />
                        <span className="text-sm">{stage.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {formData.customStages.map((stage, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <div 
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: stage.color }}
                      />
                      <span className="text-sm">{stage.name} ({stage.estimated_days} days)</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {errors.submit && <p className="text-sm text-red-500 mt-4">{errors.submit}</p>}
        </Card>
      )}

      <div className="flex justify-between mt-8">
        <div>
          {currentStep !== 'details' && (
            <Button onClick={handleBack} variant="outline">
              Back
            </Button>
          )}
        </div>
        
        <div className="space-x-3">
          <Button onClick={onCancel} variant="outline">
            Cancel
          </Button>
          {currentStep === 'review' ? (
            <Button onClick={handleSubmit} disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create Project'}
            </Button>
          ) : (
            <Button onClick={handleNext}>
              Next
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}