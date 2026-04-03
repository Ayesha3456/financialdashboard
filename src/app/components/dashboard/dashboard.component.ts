import {
  Component, Input, OnChanges, AfterViewInit,
  ViewChild, ElementRef, inject, effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FinanceService } from '../../services/finance.service';
import { Transaction } from '../../models/finance.model';
import * as d3 from 'd3';

const COLORS: Record<string, string> = {
  Salary: '#16a37f',
  Freelance: '#3b82f6',
  Food: '#ef4444',
  Transport: '#f59e0b',
  Rent: '#8b5cf6',
  Shopping: '#f97316',
  Health: '#10b981',
  Entertainment: '#ec4899',
  Utilities: '#06b6d4',
  Other: '#94a3b8'
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements AfterViewInit, OnChanges {
  @Input() page = 'overview';

  @ViewChild('lineRef') lineRef!: ElementRef;
  @ViewChild('donutRef') donutRef!: ElementRef;
  @ViewChild('barRef') barRef!: ElementRef;

  fs = inject(FinanceService);
  cats = Object.keys(COLORS);
  colors = COLORS;

  form = {
    date: today(),
    amount: 0,
    category: 'Food',
    type: 'expense' as 'income' | 'expense',
    description: ''
  };

  editing: Transaction | null = null;

  topCat = '';
  topCatAmt = 0;
  savingsRate = 0;
  avgTx = 0;
  monthly: { label: string; inc: number; exp: number; net: number }[] = [];

  constructor() {
    effect(() => {
      this.fs.transactions();
      this.fs.searchQuery();
      this.fs.filterType();
      this.fs.filterCategory();
      this.fs.selectedCategory();
      setTimeout(() => this.draw(), 60);
    });
  }

  ngAfterViewInit() {
    setTimeout(() => this.draw(), 120);
  }

  ngOnChanges() {
    setTimeout(() => this.draw(), 60);
  }

  draw() {
    if (this.page === 'overview') {
      this.drawLine();
      this.drawDonut();
    }

    if (this.page === 'insights') {
      this.drawBar();
      this.calcInsights();
    }
  }

  drawLine() {
    if (!this.lineRef) return;

    const el = this.lineRef.nativeElement;
    d3.select(el).selectAll('*').remove();

    const transactions = this.fs.filtered();
    if (!transactions.length) return;

    const sorted = [...transactions].sort((a, b) => +new Date(a.date) - +new Date(b.date));

    let run = 0;
    const pts = sorted.map(t => {
      run += t.type === 'income' ? t.amount : -t.amount;
      return { d: new Date(t.date + 'T12:00'), v: run };
    });

    const m = { t: 20, r: 20, b: 36, l: 65 };
    const W = el.offsetWidth || 560;
    const H = 240;
    const w = W - m.l - m.r;
    const h = H - m.t - m.b;

    const svg = d3.select(el).append('svg').attr('width', W).attr('height', H);
    const g = svg.append('g').attr('transform', `translate(${m.l},${m.t})`);

    const x = d3.scaleTime()
      .domain(d3.extent(pts, p => p.d) as [Date, Date])
      .range([0, w]);

    const minY = Math.min(0, d3.min(pts, p => p.v) || 0);
    const maxY = (d3.max(pts, p => p.v) || 1000) * 1.15;

    const y = d3.scaleLinear()
      .domain([minY, maxY])
      .range([h, 0]);

    g.append('g')
      .call(d3.axisLeft(y).ticks(4).tickSize(-w).tickFormat('' as any))
      .call(gg => {
        gg.select('.domain').remove();
        gg.selectAll('line').attr('stroke', '#f0f0f0');
      });

    const area = d3.area<any>()
      .x(p => x(p.d))
      .y0(h)
      .y1(p => y(p.v))
      .curve(d3.curveMonotoneX);

    const line = d3.line<any>()
      .x(p => x(p.d))
      .y(p => y(p.v))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(pts)
      .attr('fill', 'rgba(22,163,127,0.08)')
      .attr('d', area);

    g.append('path')
      .datum(pts)
      .attr('fill', 'none')
      .attr('stroke', '#16a37f')
      .attr('stroke-width', 2.5)
      .attr('d', line);

    g.selectAll('circle')
      .data(pts)
      .enter()
      .append('circle')
      .attr('cx', p => x(p.d))
      .attr('cy', p => y(p.v))
      .attr('r', 4)
      .attr('fill', '#16a37f')
      .attr('stroke', '#fff')
      .attr('stroke-width', 2);

    g.append('g')
      .attr('transform', `translate(0,${h})`)
      .call(d3.axisBottom(x).ticks(5).tickFormat(d3.timeFormat('%b %d') as any))
      .call(gg => {
        gg.select('.domain').remove();
        gg.selectAll('line').remove();
        gg.selectAll('text').attr('font-size', '11px').attr('fill', '#aaa');
      });

    g.append('g')
      .call(d3.axisLeft(y).ticks(4).tickFormat(v => '$' + d3.format(',')(v as number)))
      .call(gg => {
        gg.select('.domain').remove();
        gg.selectAll('line').remove();
        gg.selectAll('text').attr('font-size', '11px').attr('fill', '#aaa');
      });
  }

  drawDonut() {
    if (!this.donutRef) return;

    const el = this.donutRef.nativeElement;
    d3.select(el).selectAll('*').remove();

    const txs = this.fs.transactions();
    const data = d3.rollups(
      txs.filter(t => t.type === 'expense'),
      v => d3.sum(v, d => d.amount),
      d => d.category
    ).sort((a, b) => b[1] - a[1]);

    if (!data.length) return;

    const size = 220;
    const R = size / 2;
    const inner = R * 0.55;

    const svg = d3.select(el).append('svg').attr('width', size).attr('height', size);
    const g = svg.append('g').attr('transform', `translate(${R},${R})`);

    const pieData = d3.pie<[string, number]>()
      .value(d => d[1])
      .sort(null)
      .padAngle(0.03)(data);

    const arc = d3.arc<d3.PieArcDatum<[string, number]>>()
      .innerRadius(inner)
      .outerRadius(R - 6);

    const arcHover = d3.arc<d3.PieArcDatum<[string, number]>>()
      .innerRadius(inner)
      .outerRadius(R);

    g.selectAll('path')
      .data(pieData)
      .enter()
      .append('path')
      .attr('d', d => (this.fs.selectedCategory() === d.data[0] ? arcHover(d) : arc(d)) as string)
      .attr('fill', d => COLORS[d.data[0]] || '#aaa')
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .style('opacity', d =>
        !this.fs.selectedCategory() || this.fs.selectedCategory() === d.data[0] ? 1 : 0.35
      )
      .on('mouseover', function (_, d) {
        d3.select(this).attr('d', arcHover(d) as string);
            })
            .on('mouseout', (event, d) => {
        const isActive = this.fs.selectedCategory() === d.data[0];
        d3.select(event.currentTarget as SVGPathElement).attr('d', (isActive ? arcHover(d) : arc(d)) as string);
            })
            .on('click', (event, d) => {
        this.fs.toggleCategoryFromChart(d.data[0]);
      });

    const selected = this.fs.selectedCategory();
    const total = d3.sum(data, d => d[1]);
    const selectedValue = selected ? (data.find(d => d[0] === selected)?.[1] || 0) : total;

    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '-0.3em')
      .attr('font-size', '11px')
      .attr('fill', '#aaa')
      .text(selected || 'Total');

    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '1.1em')
      .attr('font-size', '15px')
      .attr('font-weight', '600')
      .attr('fill', '#222')
      .text('$' + selectedValue.toLocaleString());
  }

  drawBar() {
    if (!this.barRef) return;

    const el = this.barRef.nativeElement;
    d3.select(el).selectAll('*').remove();

    const monthly: Record<string, { inc: number; exp: number }> = {};

    this.fs.filtered().forEach(t => {
      const k = t.date.substring(0, 7);
      if (!monthly[k]) monthly[k] = { inc: 0, exp: 0 };
      monthly[k][t.type === 'income' ? 'inc' : 'exp'] += t.amount;
    });

    const keys = Object.keys(monthly).sort();
    if (!keys.length) return;

    const labels = keys.map(k => {
      const [y, mo] = k.split('-');
      return new Date(+y, +mo - 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    });

    const incD = keys.map(k => monthly[k].inc);
    const expD = keys.map(k => monthly[k].exp);

    const m = { t: 16, r: 16, b: 44, l: 65 };
    const W = el.offsetWidth || 660;
    const H = 260;
    const w = W - m.l - m.r;
    const h = H - m.t - m.b;

    const svg = d3.select(el).append('svg').attr('width', W).attr('height', H);
    const g = svg.append('g').attr('transform', `translate(${m.l},${m.t})`);

    const x0 = d3.scaleBand().domain(labels).range([0, w]).paddingInner(0.25);
    const x1 = d3.scaleBand().domain(['inc', 'exp']).range([0, x0.bandwidth()]).padding(0.08);
    const yMax = Math.max(...incD, ...expD, 1);

    const y = d3.scaleLinear().domain([0, yMax * 1.15]).range([h, 0]);

    g.append('g')
      .call(d3.axisLeft(y).ticks(4).tickSize(-w).tickFormat('' as any))
      .call(gg => {
        gg.select('.domain').remove();
        gg.selectAll('line').attr('stroke', '#f0f0f0');
      });

    const drawBars = (vals: number[], key: string, color: string) =>
      g.selectAll(`.b-${key}`)
        .data(vals)
        .enter()
        .append('rect')
        .attr('class', `b-${key}`)
        .attr('x', (_, i) => (x0(labels[i]) ?? 0) + (x1(key) ?? 0))
        .attr('y', d => y(d))
        .attr('width', x1.bandwidth())
        .attr('height', d => h - y(d))
        .attr('fill', color)
        .attr('rx', 3);

    drawBars(incD, 'inc', '#16a37f');
    drawBars(expD, 'exp', '#ef4444');

    g.append('g')
      .attr('transform', `translate(0,${h})`)
      .call(d3.axisBottom(x0).tickSize(0))
      .call(gg => {
        gg.select('.domain').attr('stroke', '#eee');
        gg.selectAll('text').attr('font-size', '11px').attr('fill', '#aaa').attr('dy', '1.4em');
      });

    g.append('g')
      .call(d3.axisLeft(y).ticks(4).tickFormat(v => '$' + d3.format(',')(v as number)))
      .call(gg => {
        gg.select('.domain').remove();
        gg.selectAll('line').remove();
        gg.selectAll('text').attr('font-size', '11px').attr('fill', '#aaa');
      });
  }

  calcInsights() {
    const txs = this.fs.filtered();
    const expByCat: Record<string, number> = {};

    txs
      .filter(t => t.type === 'expense')
      .forEach(t => expByCat[t.category] = (expByCat[t.category] || 0) + t.amount);

    const top = Object.entries(expByCat).sort((a, b) => b[1] - a[1])[0];
    this.topCat = top ? top[0] : 'None';
    this.topCatAmt = top ? top[1] : 0;

    const inc = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const exp = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

    this.savingsRate = inc > 0 ? Math.round(((inc - exp) / inc) * 100) : 0;
    this.avgTx = txs.length ? Math.round(txs.reduce((s, t) => s + t.amount, 0) / txs.length) : 0;

    const monthlyMap: Record<string, { inc: number; exp: number }> = {};
    txs.forEach(t => {
      const k = t.date.substring(0, 7);
      if (!monthlyMap[k]) monthlyMap[k] = { inc: 0, exp: 0 };
      monthlyMap[k][t.type === 'income' ? 'inc' : 'exp'] += t.amount;
    });

    this.monthly = Object.keys(monthlyMap)
      .sort()
      .reverse()
      .slice(0, 6)
      .map(k => ({
        label: new Date(k + '-01').toLocaleDateString('en-US', { month: 'short' }),
        inc: monthlyMap[k].inc,
        exp: monthlyMap[k].exp,
        net: monthlyMap[k].inc - monthlyMap[k].exp
      }));
  }

  submitAdd() {
    if (!this.form.description || this.form.amount <= 0) return;
    this.fs.add({ ...this.form });
    this.form = { date: today(), amount: 0, category: 'Food', type: 'expense', description: '' };
  }

  startEdit(t: Transaction) {
    this.editing = { ...t };
  }

  saveEdit() {
    if (this.editing) {
      this.fs.update(this.editing);
      this.editing = null;
    }
  }

  cancelEdit() {
    this.editing = null;
  }

  del(id: string) {
    if (confirm('Delete?')) this.fs.remove(id);
  }

  fmt(v: number) {
    return '$' + Math.abs(v).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  fmtDate(d: string) {
    return new Date(d + 'T12:00').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  color(cat: string) {
    return COLORS[cat] || '#aaa';
  }

onDescriptionChange(value: string) {
  if (!value) {
    this.form.description = '';
    return;
  }

  this.form.description = value.charAt(0).toUpperCase() + value.slice(1);
}

onEditDescriptionChange(value: string) {
  if (!this.editing) return;

  if (!value) {
    this.editing.description = '';
    return;
  }

  this.editing.description = value.charAt(0).toUpperCase() + value.slice(1);
}

}

function today() {
  return new Date().toISOString().split('T')[0];
}