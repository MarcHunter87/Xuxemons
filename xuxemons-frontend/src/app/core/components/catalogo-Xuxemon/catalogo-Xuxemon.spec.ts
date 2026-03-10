import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CatalogoXuxemon } from './catalogo-Xuxemon';

describe('CatalogoXuxemon', () => {
  let component: CatalogoXuxemon;
  let fixture: ComponentFixture<CatalogoXuxemon>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CatalogoXuxemon]
    })
      .compileComponents();

    fixture = TestBed.createComponent(CatalogoXuxemon);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
