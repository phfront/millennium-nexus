export interface ParsedItem {
  title: string;
  is_completed: boolean;
  description: string;
}

export interface ParsedDay {
  day_number: number;
  title: string;
  content_prompt: string;
  items: ParsedItem[];
}

export interface ParsedSection {
  title: string;
  days: ParsedDay[];
}

export interface ParsedPlan {
  sections: ParsedSection[];
  unsectionedDays: ParsedDay[];
}

export function parseMarkdownToPlan(markdown: string): ParsedPlan {
  const lines = markdown.split('\n');
  const sections: ParsedSection[] = [];
  const unsectionedDays: ParsedDay[] = [];
  
  let currentSection: ParsedSection | null = null;
  let currentDay: ParsedDay | null = null;
  let currentItem: ParsedItem | null = null;
  
  let currentContentPrompt: string[] = [];
  let currentItemDescription: string[] = [];
  
  let globalDayCounter = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Section (H1)
    if (trimmed.startsWith('# ')) {
      // Flush day
      if (currentDay) {
        currentDay.content_prompt = currentContentPrompt.join('\n').trim();
        if (currentItem) {
           currentItem.description = currentItemDescription.join('\n').trim();
           currentDay.items.push(currentItem);
        }
        if (currentSection) currentSection.days.push(currentDay);
        else unsectionedDays.push(currentDay);
      }
      
      currentDay = null;
      currentItem = null;
      currentContentPrompt = [];
      currentItemDescription = [];

      currentSection = {
        title: trimmed.replace(/^#\s+/, ''),
        days: []
      };
      sections.push(currentSection);
      continue;
    }

    // Day (H2)
    if (trimmed.startsWith('## ')) {
      // Flush previous day
      if (currentDay) {
        currentDay.content_prompt = currentContentPrompt.join('\n').trim();
        if (currentItem) {
           currentItem.description = currentItemDescription.join('\n').trim();
           currentDay.items.push(currentItem);
        }
        if (currentSection) currentSection.days.push(currentDay);
        else unsectionedDays.push(currentDay);
      }

      currentItem = null;
      currentContentPrompt = [];
      currentItemDescription = [];

      let title = trimmed.replace(/^##\s+/, '');
      // Try to extract Day number if formatted like "Dia 1 - Title" or "Dia 1: Title"
      let dayNumber = globalDayCounter++;
      const match = title.match(/^Dia\s+(\d+)\s*[—\-:\|]?\s*(.*)/i);
      if (match) {
         dayNumber = parseInt(match[1]);
         title = match[2].trim() || `Dia ${dayNumber}`;
      }

      currentDay = {
        day_number: dayNumber,
        title,
        content_prompt: '',
        items: []
      };
      continue;
    }

    // Task Item
    // format: "- [ ] Task title" or "- [x] Task title"
    const isTaskMatch = line.match(/^(\s*)-\s+\[(.)\]\s+(.*)/);
    if (isTaskMatch) {
      if (currentItem && currentDay) {
         currentItem.description = currentItemDescription.join('\n').trim();
         currentDay.items.push(currentItem);
      }

      currentItem = {
        title: isTaskMatch[3].trim(),
        is_completed: isTaskMatch[2].toLowerCase() === 'x',
        description: ''
      };
      currentItemDescription = [];
      continue;
    }

    // If it's none of the headers/tasks, it's body text.
    // If we have an active item, indent matching determines if it's item description or day prompt.
    // Usually, anything after a task item belongs to the task (or to the next element).
    if (currentItem) {
       currentItemDescription.push(line);
    } else if (currentDay) {
       currentContentPrompt.push(line);
    }
  }

  // Flush last day
  if (currentDay) {
    currentDay.content_prompt = currentContentPrompt.join('\n').trim();
    if (currentItem) {
       currentItem.description = currentItemDescription.join('\n').trim();
       currentDay.items.push(currentItem);
    }
    if (currentSection) currentSection.days.push(currentDay);
    else unsectionedDays.push(currentDay);
  }

  // Se tem conteúdo solto "em cima" antes de H1, e precisamos agrupar
  // Mas ignorvamos aqui por simplicidade.
  
  return { sections, unsectionedDays };
}

// Convert JSON Tree back to Markdown
export function planToMarkdown(sections: any[], unsectionedDays: any[]): string {
  let md = '';

  const renderDay = (day: any) => {
    md += `## Dia ${day.day_number} - ${day.title}\n`;
    if (day.content_prompt) {
      md += `${day.content_prompt}\n`;
    }
    md += '\n';

    if (day.items && day.items.length > 0) {
      day.items.forEach((item: any) => {
        md += `- [${item.is_completed ? 'x' : ' '}] ${item.title}\n`;
        if (item.description) {
           // ensure it has a newline at the end
           let desc = item.description.trim().split('\n').map((l: string) => `  ${l}`).join('\n');
           md += `${desc}\n`;
        }
      });
      md += '\n';
    }
  };

  // Render unsectioned
  const sortedUnsectioned = [...unsectionedDays].sort((a,b) => a.day_number - b.day_number);
  sortedUnsectioned.forEach(renderDay);

  // Render sections
  const sortedSections = [...sections].sort((a,b) => a.order_index - b.order_index);
  sortedSections.forEach(sec => {
    md += `# ${sec.title}\n\n`;
    const days = sec.days ? [...sec.days].sort((a: any,b: any) => a.day_number - b.day_number) : [];
    days.forEach(renderDay);
  });

  return md.trim();
}
