import { AfterViewChecked, Component, HostListener, inject, signal, OnInit, OnDestroy, ViewChild, ElementRef, computed } from '@angular/core';
import { Subscription } from 'rxjs';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { XuxemonService, Xuxemon } from '../../core/services/xuxemon.service';
import { AuthService } from '../../core/services/auth';

@Component({
    selector: 'app-gacha',
    standalone: true,
    imports: [DatePipe],
    templateUrl: './gacha.html',
    styleUrl: './gacha.css',
})
export class Gacha implements OnInit, OnDestroy, AfterViewChecked {
    private readonly winnerIndex = 80;
    private xuxemonService = inject(XuxemonService);
    private router = inject(Router);
    readonly auth = inject(AuthService);
    private subs = new Subscription();

    @ViewChild('rouletteBox') rouletteBox!: ElementRef<HTMLElement>;
    @ViewChild('awardDialogRoot') awardDialogRoot?: ElementRef<HTMLElement>;
    @ViewChild('awardCloseButton') awardCloseButton?: ElementRef<HTMLButtonElement>;
    @ViewChild('spinErrorDialogRoot') spinErrorDialogRoot?: ElementRef<HTMLElement>;
    @ViewChild('spinErrorOkButton') spinErrorOkButton?: ElementRef<HTMLButtonElement>;
    @ViewChild('gachaAudio') gachaAudio?: ElementRef<HTMLAudioElement>;
    @ViewChild('modalAudio') modalAudio?: ElementRef<HTMLAudioElement>;
    private modalAudioRestoreTimeout?: ReturnType<typeof setTimeout>;

    public isSpinning = signal(false);
    public noTransition = signal(false);
    public awardedXuxemon = signal<Xuxemon | null>(null);
    public showAward = signal(false);
    public spinError = signal<string | null>(null);
    public rouletteItems = signal<Xuxemon[]>([]);
    public trackTransform = signal<string>('translateX(0)');
    public isDataLoaded = signal(false);
    public historyXuxemons = computed(() => this.myXuxemonsList().slice(0, 6));
    private myXuxemonsList = signal<Xuxemon[]>([]);
    private previousFocusedElement: HTMLElement | null = null;
    private shouldFocusAwardCloseButton = false;
    private shouldFocusErrorButton = false;

    readonly revealRayAngles = Array.from({ length: 14 }, (_, i) => Math.round((i * 360) / 14));
    revealSparkles: Array<{ x: number; y: number; size: number; delay: number; duration: number }> = [];

    ngOnInit() {
        this.auth.refreshGachaTickets();
        this.loadRoulette();
        this.xuxemonService.loadMyXuxemons();
        this.subs.add(this.xuxemonService.myXuxemonsList.subscribe(list => this.myXuxemonsList.set(list)));
    }

    ngOnDestroy() {
        this.subs.unsubscribe();
    }

    ngAfterViewChecked(): void {
        if (this.shouldFocusAwardCloseButton && this.awardCloseButton?.nativeElement) {
            this.awardCloseButton.nativeElement.focus();
            this.shouldFocusAwardCloseButton = false;
        }

        if (this.shouldFocusErrorButton && this.spinErrorOkButton?.nativeElement) {
            this.spinErrorOkButton.nativeElement.focus();
            this.shouldFocusErrorButton = false;
        }
    }

    async loadRoulette() {
        await this.xuxemonService.loadAllXuxemons();
        this.isDataLoaded.set(true);
        this.initRoulette();
    }

    initRoulette() {
        const list = this.xuxemonService.getXuxemonsList();
        if (list.length > 0) {
            this.rouletteItems.set(Array.from({ length: 100 }, () => list[Math.floor(Math.random() * list.length)]));
        } else {
            this.rouletteItems.set([]);
        }
    }

    private getWinnerOffsetResponsive(index: number): number {
        const box = this.rouletteBox?.nativeElement;
        if (!box) return 0;

        const track = box.querySelector('.roulette-track') as HTMLElement | null;
        const items = box.querySelectorAll('.roulette-item');
        const winnerItem = items.item(index) as HTMLElement | null;
        if (!track || !winnerItem) return 0;

        const containerWidth = box.offsetWidth;
        const winnerCenter = winnerItem.offsetLeft + (winnerItem.offsetWidth / 2);
        return (containerWidth / 2) - winnerCenter;
    }

    private playGachaAudio() {
        const audio = this.gachaAudio?.nativeElement;
        if (!audio) return;
        audio.volume = 0.4;
        audio.currentTime = 0;
        audio.play().catch(e => console.warn('Audio playback prevented by browser policy', e));
    }

    private stopGachaAudio() {
        const audio = this.gachaAudio?.nativeElement;
        if (!audio) return;
        audio.pause();
        audio.currentTime = 0;
    }

    async spin() {
        if (this.isSpinning()) return;
        if (this.auth.gachaTicketCount() < 1) return;

        this.previousFocusedElement = typeof document !== 'undefined'
            ? (document.activeElement as HTMLElement | null)
            : null;

        this.showAward.set(false);
        this.awardedXuxemon.set(null);
        this.spinError.set(null);
        this.isSpinning.set(true);
        this.playGachaAudio();

        this.noTransition.set(true);
        this.trackTransform.set('translateX(0)');
        this.initRoulette();

        const winner = await this.xuxemonService.awardRandomXuxemonGacha();

        if (!winner) {
            this.stopGachaAudio();
            this.isSpinning.set(false);
            this.noTransition.set(false);
            this.spinError.set(
                "Couldn't complete the spin. Make sure you have tickets and your session is still active."
            );
            this.shouldFocusErrorButton = true;
            return;
        }

        this.rouletteItems.update(items => {
            const newItems = [...items];
            newItems[this.winnerIndex] = winner;
            return newItems;
        });

        setTimeout(() => {
            this.noTransition.set(false);
            setTimeout(() => {
                const offset = this.getWinnerOffsetResponsive(this.winnerIndex);
                this.trackTransform.set(`translateX(${offset}px)`);
            }, 20);
        }, 50);

        setTimeout(() => {
            this.generateSparkles();
            this.isSpinning.set(false);
            this.awardedXuxemon.set(winner);
            this.showAward.set(true);
            this.shouldFocusAwardCloseButton = true;
            this.playModalRevealAudio();
        }, 6200);
    }

    spinAgain() {
        this.closeModal();
        this.spin();
    }

    get viewAnimations(): boolean {
        return this.auth.getUser()?.view_animations ?? true;
    }

    getTypeColor(typeName: string): string {
        switch (typeName) {
            case 'Power': return '#D0181B';
            case 'Speed': return '#0D6EFD';
            case 'Technical': return '#28A745';
            default: return '#777';
        }
    }

    getTypeColorGlow(typeName: string): string {
        switch (typeName) {
            case 'Power': return 'rgba(208, 24, 27, 0.5)';
            case 'Speed': return 'rgba(13, 110, 253, 0.5)';
            case 'Technical': return 'rgba(40, 167, 69, 0.5)';
            default: return 'rgba(119, 119, 119, 0.5)';
        }
    }

    private playModalRevealAudio() {
        const bgm = this.gachaAudio?.nativeElement;
        const sfx = this.modalAudio?.nativeElement;
        if (bgm) bgm.volume = 0.25;
        if (sfx) {
            sfx.volume = 0.9;
            sfx.currentTime = 0;
            sfx.play().catch(e => console.warn('Modal audio playback prevented', e));
        }
        this.modalAudioRestoreTimeout = setTimeout(() => {
            if (bgm) bgm.volume = 0.4;
        }, 2800);
    }

    private generateSparkles() {
        const count = 100;
        this.revealSparkles = Array.from({ length: count }, () => {
            const x = -8 + Math.random() * 116;
            const y = -8 + Math.random() * 116;
            const size = 2 + Math.random() * 8;
            const delay = Math.random() * 2.4;
            const duration = 1.2 + Math.random() * 2.6;
            return { x, y, size, delay, duration };
        });
    }

    goToXuxemonDetailsFromRecent(xuxemonId: number): void {
        if (!Number.isFinite(xuxemonId)) {
            return;
        }
        this.router.navigate(['/xuxedex'], {
            queryParams: { openXuxemonId: xuxemonId },
        });
    }

    closeModal() {
        clearTimeout(this.modalAudioRestoreTimeout);
        const sfx = this.modalAudio?.nativeElement;
        if (sfx) { sfx.pause(); sfx.currentTime = 0; }
        this.stopGachaAudio();
        this.showAward.set(false);
        this.awardedXuxemon.set(null);
        this.xuxemonService.loadMyXuxemons();
        this.restorePreviousFocus();
    }

    closeSpinError(): void {
        this.stopGachaAudio();
        this.spinError.set(null);
        this.restorePreviousFocus();
    }

    @HostListener('document:keydown.escape')
    onEscape(): void {
        if (this.spinError()) {
            this.closeSpinError();
            return;
        }
        if (this.showAward()) this.closeModal();
    }

    @HostListener('document:keydown', ['$event'])
    onDocumentKeydown(event: KeyboardEvent): void {
        if (event.key !== 'Tab') {
            return;
        }

        if (this.spinError()) {
            this.trapFocus(event, this.spinErrorDialogRoot?.nativeElement);
            return;
        }

        if (this.showAward()) {
            this.trapFocus(event, this.awardDialogRoot?.nativeElement);
        }
    }

    onModalKeydown(event: KeyboardEvent, modal: 'award' | 'error'): void {
        if (event.key !== 'Tab') {
            return;
        }

        const root = modal === 'award'
            ? this.awardDialogRoot?.nativeElement
            : this.spinErrorDialogRoot?.nativeElement;
        this.trapFocus(event, root);
    }

    private restorePreviousFocus(): void {
        if (this.previousFocusedElement && typeof this.previousFocusedElement.focus === 'function') {
            setTimeout(() => this.previousFocusedElement?.focus(), 0);
        }
    }

    private trapFocus(event: KeyboardEvent, root?: HTMLElement): void {
        if (!root) {
            return;
        }

        const focusableSelector = [
            'a[href]',
            'button:not([disabled])',
            'textarea:not([disabled])',
            'input:not([disabled])',
            'select:not([disabled])',
            '[tabindex]:not([tabindex="-1"])',
        ].join(',');

        const focusableElements = Array.from(root.querySelectorAll<HTMLElement>(focusableSelector))
            .filter(element => !element.hasAttribute('disabled') && element.tabIndex !== -1);

        if (focusableElements.length === 0) {
            event.preventDefault();
            root.focus();
            return;
        }

        const first = focusableElements[0];
        const last = focusableElements[focusableElements.length - 1];
        const active = document.activeElement as HTMLElement | null;
        const activeInside = !!active && root.contains(active);

        if (!activeInside) {
            event.preventDefault();
            (event.shiftKey ? last : first).focus();
            return;
        }

        if (event.shiftKey && active === first) {
            event.preventDefault();
            last.focus();
            return;
        }

        if (!event.shiftKey && active === last) {
            event.preventDefault();
            first.focus();
        }
    }
}
