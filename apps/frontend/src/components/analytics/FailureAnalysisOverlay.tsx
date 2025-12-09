'use client';

import { Button, Card, CardBody, CardHeader } from '@heroui/react';
import { AlertTriangle, Brain, CheckCircle, Copy, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { MarkdownRenderer } from '../markdown-renderer';

interface FailureAnalysisOverlayProps {
  reportId: string;
  testId: string;
  testTitle: string;
  failedStepIndex: number;
  errorMessage?: string;
  onAnalysisComplete?: (analysis: FailureAnalysis) => void;
}

interface FailureAnalysis {
  id: string;
  reportId: string;
  testId: string;
  testTitle: string;
  rootCause: string;
  confidence: 'high' | 'medium' | 'low';
  debuggingSteps: string[];
  codeFix: string;
  preventionStrategy: string;
  model: string;
  generatedAt: Date;
}

export function FailureAnalysisOverlay({
  reportId,
  testId,
  testTitle,
  failedStepIndex,
  errorMessage,
  onAnalysisComplete,
}: Readonly<FailureAnalysisOverlayProps>) {
  const [isLoading, setIsLoading] = useState(false);
  const [analysis, setAnalysis] = useState<FailureAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyzeFailure = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const prompt = generateFailureAnalysisPrompt({
        testName: testTitle,
        testId,
        reportId,
        errorMessage: errorMessage || 'Unknown error',
        failedStepIndex,
      });

      const response = await fetch('/api/llm/analyze-failure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          testId,
          reportId,
          request: {
            reportId,
            testId,
            failedStepIndex,
            includeHistory: true,
            includePerformance: true,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Analysis failed');
      }

      const result = await response.json();

      if (result.success) {
        const parsedResponse = parseLLMResponse(result.data.content);

        const analysisData: FailureAnalysis = {
          id: Date.now().toString(),
          reportId,
          testId,
          testTitle,
          rootCause: parsedResponse.rootCause,
          confidence: parsedResponse.confidence,
          debuggingSteps: parsedResponse.debuggingSteps,
          codeFix: parsedResponse.codeFix,
          preventionStrategy: parsedResponse.preventionStrategy,
          model: result.data.model,
          generatedAt: new Date(),
        };

        setAnalysis(analysisData);
        onAnalysisComplete?.(analysisData);
        toast.success('AI analysis completed successfully');
      } else {
        throw new Error(result.error || 'Analysis failed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      toast.error('Failed to analyze failure with AI');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyAnalysis = () => {
    if (!analysis) return;

    const text = `
LLM Analysis for "${testTitle}"

Root Cause:
${analysis.rootCause}

Confidence: ${analysis.confidence.toUpperCase()}

Model: ${analysis.model}
Generated: ${analysis.generatedAt.toLocaleString()}
    `.trim();

    navigator.clipboard.writeText(text);
    toast.success('Analysis copied to clipboard');
  };

  const getConfidenceIcon = (confidence: string) => {
    switch (confidence) {
      case 'high':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'medium':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high':
        return 'text-green-600 dark:text-green-400';
      case 'medium':
        return 'text-yellow-600 dark:text-yellow-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  return (
    <div className="space-y-4">
      {!analysis && !isLoading && !error && (
        <Button
          onPress={handleAnalyzeFailure}
          color="primary"
          variant="flat"
          startContent={<Brain className="h-4 w-4" />}
          size="sm"
        >
          🤖 Analyze with LLM
        </Button>
      )}

      {isLoading && (
        <Button
          isDisabled
          color="primary"
          variant="flat"
          startContent={<Loader2 className="h-4 w-4 animate-spin" />}
          size="sm"
        >
          ⏳ Analyzing...
        </Button>
      )}

      {error && (
        <Card className="border-red-200 dark:border-red-800">
          <CardBody className="p-4">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">Analysis failed</span>
            </div>
            <p className="text-xs text-red-500 dark:text-red-300 mt-1">{error}</p>
          </CardBody>
        </Card>
      )}

      {analysis && (
        <Card className="shadow-lg">
          <CardHeader className="pb-3">
            <div className="flex justify-between items-center w-full">
              <div className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-blue-500" />
                <h4 className="font-semibold">LLM Analysis Result</h4>
                <span className="text-xs text-gray-500">({analysis.model})</span>
              </div>
              <Button isIconOnly size="sm" variant="light" onPress={() => setAnalysis(null)}>
                ×
              </Button>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            <div>
              <h5 className="font-medium mb-2 text-gray-700 dark:text-gray-300">Root Cause</h5>
              <div className="flex items-center gap-2 mb-2">
                {getConfidenceIcon(analysis.confidence)}
                <span className={`text-sm font-medium ${getConfidenceColor(analysis.confidence)}`}>
                  Confidence: {analysis.confidence.toUpperCase()}
                </span>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded border">
                <MarkdownRenderer content={analysis.rootCause} />
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t">
              <Button
                size="sm"
                variant="flat"
                startContent={<Copy className="h-3 w-3" />}
                onPress={handleCopyAnalysis}
              >
                Copy Analysis
              </Button>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function parseLLMResponse(content: string): {
  rootCause: string;
  confidence: 'high' | 'medium' | 'low';
  debuggingSteps: string[];
  codeFix: string;
  preventionStrategy: string;
} {
  // TODO: use structured output
  let rootCause = content;
  let confidence: 'high' | 'medium' | 'low' = 'medium';
  let debuggingSteps: string[] = [];
  let codeFix = '';
  let preventionStrategy = '';

  const sections = content.split(/\d+\.\s+/).filter((s) => s.trim());

  if (sections.length > 0) {
    rootCause = sections[0] || content;
  }
  if (sections.length > 1) {
    debuggingSteps = sections[1]
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.startsWith('-') || s.startsWith('•'))
      .map((s) => s.replace(/^[-•]\s*/, ''));
  }
  if (sections.length > 2) {
    codeFix = sections[2];
  }
  if (sections.length > 3) {
    preventionStrategy = sections[3];
  }

  if (content.toLowerCase().includes('definitely') || content.toLowerCase().includes('certain')) {
    confidence = 'high';
  } else if (
    content.toLowerCase().includes('might') ||
    content.toLowerCase().includes('possibly') ||
    content.toLowerCase().includes('unclear')
  ) {
    confidence = 'low';
  }

  return {
    rootCause: rootCause.trim(),
    confidence,
    debuggingSteps:
      debuggingSteps.length > 0 ? debuggingSteps : ['Review test logs and error details'],
    codeFix: codeFix.trim(),
    preventionStrategy: preventionStrategy.trim(),
  };
}

function generateFailureAnalysisPrompt(data: {
  testName: string;
  testId: string;
  reportId: string;
  errorMessage: string;
  failedStepIndex: number;
}): string {
  return `
Analyze this failing test and suggest root causes:

Test: ${data.testName}
Test ID: ${data.testId}
Report ID: ${data.reportId || 'Unknown'}
Error: ${data.errorMessage || 'No error message available'}
Failed at step index: ${data.failedStepIndex}

Please provide:
1. Most likely root cause
2. Specific debugging steps
3. Code fix recommendation (if applicable)
4. Prevention strategy for similar issues

Be specific and actionable. Keep your response concise.
  `.trim();
}
