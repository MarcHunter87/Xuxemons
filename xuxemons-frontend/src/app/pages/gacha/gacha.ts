import { Component, inject, signal, OnInit } from '@angular/core';
import { XuxemonService, Xuxemon } from '../../core/services/xuxemon.service';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-gacha',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './gacha.html',
    styleUrl: './gacha.css',
})
export class Gacha implements OnInit {
    private xuxemonService = inject(XuxemonService);

    public isSpinning = signal(false);
    public awardedXuxemon = signal<Xuxemon | null>(null);
    public showAward = signal(false);
    public toastXuxemon = signal<Xuxemon | null>(null);
    public rouletteItems = signal<Xuxemon[]>([]);
    public trackTransform = signal<string>('translateX(0)');
    public isDataLoaded = signal(false);

    ngOnInit() {
        this.refreshRoulette();
    }

    async refreshRoulette() {
        await this.xuxemonService.loadAllXuxemons();
        this.isDataLoaded.set(true);
        this.initRoulette();
    }

    initRoulette() {
        const currentList = this.xuxemonService.xuxemonsList();
        if (currentList.length > 0) {
            const initialList = Array.from({ length: 100 }, () => currentList[Math.floor(Math.random() * currentList.length)]);
            this.rouletteItems.set(initialList);
        } else {
            this.rouletteItems.set([]);
        }
    }

    async spin() {
        if (this.isSpinning()) return;

        this.awardedXuxemon.set(null);

        this.isSpinning.set(true);
        this.trackTransform.set('translateX(0)');
        setTimeout(() => {
            this.trackTransform.set('translateX(-3000px)');
        }, 50);

        const winner = await this.xuxemonService.awardRandomXuxemon();

        if (!winner) {
            this.isSpinning.set(false);
            this.trackTransform.set('translateX(0)');
            alert("Session expired or error. Please log out and log in again.");
            return;
        }

        this.rouletteItems.update(items => {
            const newItems = [...items];
            newItems[80] = winner;
            return newItems;
        });

        setTimeout(() => {
            const itemWidth = 188;
            const containerWidth = 1000;
            const winnerIndex = 80;
            const offset = -(winnerIndex * itemWidth) + (containerWidth / 2) - (itemWidth / 2);
            this.trackTransform.set(`translateX(${offset}px)`);
        }, 5800);

        setTimeout(() => {
            this.isSpinning.set(false);
            this.awardedXuxemon.set(winner);
            setTimeout(() => {
                this.showAward.set(true);
                this.toastXuxemon.set(winner);
                setTimeout(() => this.toastXuxemon.set(null), 4000);
            }, 1000);
        }, 6200);
    }

    getTypeColor(typeName: string): string {
        switch (typeName) {
            case 'Power': return '#ff4757'; // Red
            case 'Speed': return '#1e90ff'; // Blue
            case 'Technical': return '#2ed573'; // Green
            default: return '#eee';
        }
    }

    closeModal() {
        this.showAward.set(false);
        this.awardedXuxemon.set(null);
        this.trackTransform.set('translateX(0)');
        this.initRoulette();
    }
}
