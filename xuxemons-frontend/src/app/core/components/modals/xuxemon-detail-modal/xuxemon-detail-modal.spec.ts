import { ComponentFixture, TestBed } from '@angular/core/testing';

import { XuxemonDetailModal } from './xuxemon-detail-modal';

describe('XuxemonDetailModal', () => {
  let component: XuxemonDetailModal;
  let fixture: ComponentFixture<XuxemonDetailModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [XuxemonDetailModal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(XuxemonDetailModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
