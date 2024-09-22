# fx2lafw WebUSB toy

- [fx2lafw](https://sigrok.org/wiki/Fx2lafw) = FX2 Logic Analyzer Firmware
- [WebUSB](https://developer.mozilla.org/en-US/docs/Web/API/WebUSB_API)
- toy - this is a toy project

This project was born out of frustration with how diffcult free logic analyzer
software is to use. Projects like [sigrok](sigrok.org) are really awesome, but
the interfaces available (e.g. PulseView) are clunky by modern standards, and
sadly are rarely receiving updates, which is a problem especially if you're
using an Arm Mac. It does work if you use the stable branch but nightlies are
failing.

Anyway, I don't have any delusions about my ability to reimplement any of this
kind of software (especially the protocol decoders), but I'm curious about how
it works under the hood, and I wanted to start with the raw data first.

In principle, there should be nothing stopping us from being able to plug in a
USB logic analyzer and visiting a web app to get busy, skipping all the tedium
of installing software and focusing on the task at hand.

So this project is kind of meant to be a proof of concept to show that this sort
of thing is possible, and to answer my almost-certainly-naïve question of "How
hard could it be?"

## Hardware

I am about as amateur as they come with respect to hardware development, so I am
using a cheap but supposedly fairly capable DLA called
[nanoDLA](https://github.com/wuxx/nanoDLA/blob/master/README_en.md).

I'm aware of (and pretty excited about) projects like
[gusmanb/logicanalyzer](https://github.com/gusmanb/logicanalyzer), but again
this is more about putting DLA UX into a web app to prove a point.

## Software

I'm just hacking stuff together based on some web app boilerplate I have. There
are probably many dubious technical decisions being made as part of this
project.

## Prior art

I came across a commercial web product called [Farprobe](https://farprobe.com/)
which purports to do just what I'm trying to do here, but as a serious project.

Unfortunately I wasn't able to get my device to work using it, and I wasn't very
happy with the UX even after importing data captures from PulseView.
